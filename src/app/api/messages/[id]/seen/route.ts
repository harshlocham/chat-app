import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import Message from "@/models/Message";
import { io } from "socket.io-client";
import { getAuthUser } from "@/lib/utils/auth/getAuthUser";
import { SocketEvents } from "@/server/socket/types/SocketEvents";

/**
 * Mark a message as seen by the authenticated user and notify connected clients.
 *
 * Validates authentication and the provided message ID, records the current timestamp
 * in the message's `seenBy` array if the user hasn't already been recorded, emits a
 * `MESSAGE_SEEN_UPDATE` socket event, and returns a success response.
 *
 * @param params - Route parameters containing `id`, the message ID to mark as seen
 * @returns `{ ok: true }` on success; on failure an error object is returned with an appropriate HTTP status
 */
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