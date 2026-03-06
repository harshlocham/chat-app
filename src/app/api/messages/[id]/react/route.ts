import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/auth/auth";
import { connectToDatabase } from "@/lib/Db/db";
import Message from "@/models/Message";
import { normalizeMessage } from "@/server/normalizers/message.normalizer";
import mongoose from "mongoose";


export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { emoji } = await req.json();

        // Auth check
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Emoji validation
        if (!emoji || typeof emoji !== "string") {
            return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
        }

        await connectToDatabase();

        // Check if message exists and is not deleted
        const message = await Message.findById(id).select("isDeleted conversationId");
        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }
        if (message.isDeleted) {
            return NextResponse.json(
                { error: "Cannot react to deleted message" },
                { status: 400 }
            );
        }

        const userId = new mongoose.Types.ObjectId(session.user.id);


        // Step 1: Remove user from all emoji arrays
        const pullUpdate: Record<string, mongoose.Types.ObjectId> = {};
        const messageDoc = await Message.findById(id).select('reactions');
        if (messageDoc && messageDoc.reactions) {
            for (const emojiKey of Object.keys(messageDoc.reactions)) {
                pullUpdate[`reactions.${emojiKey}`] = userId;
            }
        }
        await Message.updateOne({ _id: id }, { $pull: pullUpdate });

        // Step 2: Check if user was already in the target emoji (toggle off)
        const refreshed = await Message.findById(id).select('reactions');
        const alreadyReacted = Array.isArray(refreshed?.reactions?.[emoji]) &&
            refreshed.reactions[emoji].some((uid: mongoose.Types.ObjectId | string) => String(uid) === String(userId));

        if (!alreadyReacted) {
            // Toggle on: add user to target emoji
            await Message.updateOne({ _id: id }, { $addToSet: { [`reactions.${emoji}`]: userId } });
        }

        // Populate sender for normalization and return updated reactions
        const populated = await Message.findById(id)
            .populate("sender");

        const normalized = normalizeMessage(populated);

        // Emit socket event
        await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL}/internal/message-reaction`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-secret": process.env.INTERNAL_SECRET!,
            },
            body: JSON.stringify({
                conversationId: populated.conversationId.toString(),
                payload: normalized,
            }),
        });

        return NextResponse.json({ success: true, reactions: populated.reactions });
    } catch (error) {
        console.error("Reaction error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}