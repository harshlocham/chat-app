import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/auth/auth";
import { connectToDatabase } from "@/lib/Db/db";
import Message from "@/models/Message";
import { normalizeMessage } from "@/server/normalizers/message.normalizer";
import { getInternalSocketServerUrl } from "@/lib/socket/socketConfig";
import { createInternalRequestHeaders } from "@/shared/utils/internal-bridge-auth";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const message = await Message.findById(id);
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    if (message.sender.toString() !== session.user.id) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    message.isDeleted = true;
    message.content = "This message was deleted";
    await message.save();
    const normalized = normalizeMessage(message);
    const res = await fetch(`${getInternalSocketServerUrl()}/internal/message-deleted`, {
        method: "POST",
        headers: createInternalRequestHeaders(),
        body: JSON.stringify({
            conversationId: message.conversationId.toString(),
            payload: normalized,
        }),
    });
    if (!res.ok) throw new Error("Failed to broadcast message deletion");

    return NextResponse.json({ success: true });
}