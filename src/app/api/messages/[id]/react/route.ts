import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/auth";
import { connectToDatabase } from "@/lib/Db/db";
import Message from "@/models/Message";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const { id } = await params;
    const { emoji, userId } = await req.json();
    const message = await Message.findById(id);
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    const existingReaction = message.reactions.find((r: { emoji: string }) => r.emoji === emoji);
    if (existingReaction) {
        const userIndex = existingReaction.users.findIndex(
            (u: string) => u.toString() === userId
        );
        if (userIndex >= 0) {
            existingReaction.users.splice(userIndex, 1); // remove reaction
        } else {
            existingReaction.users.push(userId); // add reaction
        }
    } else {
        message.reactions.push({ emoji, users: [userId] });
    }

    await message.save();
    //  io.to(message.conversation.toString()).emit("message:reacted", message);

    return NextResponse.json({ success: true, message });
}