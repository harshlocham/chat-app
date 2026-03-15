import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import Message from "@/models/Message";
import { getAuthUser } from "@/lib/utils/auth/getAuthUser";
import { markMessageDelivered } from "@/lib/services/message-receipt.service";
import { getInternalSocketServerUrl } from "@/lib/socket/socketConfig";
import { createInternalRequestHeaders } from "@/shared/utils/internal-bridge-auth";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
        }

        const { at } = (await req.json().catch(() => ({}))) as { at?: string | Date };

        const message = await Message.findById(id).select("sender conversationId");
        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        const userId = user.id;

        // ❌ sender should NOT mark delivered
        if (message.sender.toString() === userId) {
            return NextResponse.json(
                { error: "Sender cannot mark delivered" },
                { status: 403 }
            );
        }

        const deliveredAt = at ? new Date(at) : new Date();
        await markMessageDelivered({ messageId: id, userId, at: deliveredAt });

        const response = await fetch(`${getInternalSocketServerUrl()}/internal/message-delivered`, {
            method: "POST",
            headers: createInternalRequestHeaders(),
            body: JSON.stringify({
                messageId: id,
                conversationId: message.conversationId.toString(),
                userId,
                deliveredAt,
                senderId: message.sender.toString(),
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to broadcast delivery update");
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PATCH /api/messages/:id/delivered error", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}