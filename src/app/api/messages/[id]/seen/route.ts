import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import Message from "@/models/Message";
import { io } from "socket.io-client";
import { getAuthUser } from "@/lib/utils/auth/getAuthUser";
import { SocketEvents } from "@/shared/types/SocketEvents";

export async function PATCH(
    req: NextRequest,
    res: NextResponse,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getAuthUser();
        if (!user) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }
        const messageId = params.id;
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
        }
        const seenAt = new Date();
        await Message.updateOne(
            { _id: messageId, "seenBy.userId": { $ne: user.id } },
            { $push: { seenBy: { userId: user.id, at: seenAt } } }
        );
        io().emit(SocketEvents.MESSAGE_SEEN_UPDATE, {
            messageId,
            userId: user.id,
            at: seenAt,
        });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("POST /api/messages/:id/seen error", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}