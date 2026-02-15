import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/auth/auth";
import { connectToDatabase } from "@/lib/Db/db";
import Message from "@/models/Message";

/**
 * Handles deletion of a message by id: verifies session and ownership, marks the message as deleted, and returns a JSON response.
 *
 * @param params - Promise resolving to an object with the route `id` of the message to delete.
 * @returns A JSON HTTP response: `{ success: true }` when deletion succeeds; otherwise a JSON error object with status 401 (Unauthorized), 403 (Not allowed), or 404 (Message not found).
 */
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
    message.text = "This message was deleted";
    await message.save();

    // Emit event for real-time UI update

    return NextResponse.json({ success: true });
}