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

        //  Auth check
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        //  Emoji validation
        if (!emoji || typeof emoji !== "string") {
            return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
        }

        await connectToDatabase();

        const message = await Message.findById(id)
            .populate("sender")
            .populate("reactions.user");

        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        if (message.isDeleted) {
            return NextResponse.json(
                { error: "Cannot react to deleted message" },
                { status: 400 }
            );
        }

        const userId = session.user.id;

        const existingIndex = message.reactions.findIndex(
            (r: { emoji: string; user: mongoose.Types.ObjectId }) =>
                r.user.toString() === userId && r.emoji === emoji
        );

        if (existingIndex > -1) {
            message.reactions.splice(existingIndex, 1);
        } else {
            message.reactions.push({
                emoji,
                users: userId,
            });
        }

        await message.save();

        await message.populate("reactions.user");

        const normalized = normalizeMessage(message);

        await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL}/internal/message-reaction`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-secret": process.env.INTERNAL_SECRET!,
            },
            body: JSON.stringify({
                conversationId: message.conversationId.toString(),
                payload: normalized,
            }),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Reaction error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}