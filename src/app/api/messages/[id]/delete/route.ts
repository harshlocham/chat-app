import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/Db/db";
import Message from "@/models/Message";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const message = await Message.findById(id);
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    // if (message.sender.toString() !== session.user?.email) {
    //     return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    // }

    message.isDeleted = true;
    message.text = "This message was deleted";
    await message.save();

    // Emit event for real-time UI update

    return NextResponse.json({ success: true });
}