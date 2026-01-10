import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import Message, { IMessage } from "@/models/Message";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/auth/auth";
import { connectToDatabase } from "@/lib/Db/db";

export async function PATCH(
    req: NextRequest,
    { params }: { params: { messageId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { messageId } = params;
        const { at } = await req.json();
        await connectToDatabase();
        const message = await Message.findById(messageId);
        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        const userId = session.user.id;

        // ❌ sender should NOT mark delivered
        if (message.sender.toString() === userId) {
            return NextResponse.json(
                { error: "Sender cannot mark delivered" },
                { status: 403 }
            );
        }

        // ✅ idempotent check
        // const alreadyDelivered = message.deliveredTo.some(
        //     d=> d.userId.toString() === userId
        // );

        // if (!alreadyDelivered) {
        message.deliveredTo.push({
            userId,
            at: at ? new Date(at) : new Date(),
        });
        await message.save();
        // }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PATCH /api/messages/:id/delivered error", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}