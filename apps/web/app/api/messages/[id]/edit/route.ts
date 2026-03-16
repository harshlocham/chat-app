import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/auth/auth";
import { connectToDatabase } from "@/lib/Db/db";
import Message from "@/models/Message";
import { Conversation } from "@/models/Conversation";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { id } = await params;

        await connectToDatabase();
        const { newText } = await req.json();
        const textToUpdate = newText; // Support both field names for compatibility
        if (!textToUpdate) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
        const message = await Message.findById(id);
        const con = await Conversation.findById(message.conversationId);

        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        if (message.sender.toString() !== session.user.id) {
            return NextResponse.json({ error: "Not allowed" }, { status: 403 });
        }

        message.content = textToUpdate;
        message.isEdited = true;
        await message.save();
        if (con.lastMessage._id !== message._id) {
            con.lastMessage.content = textToUpdate;
            await con.save();
        }

        // Populate the message before returning
        const populated = await Message.findById(message._id)
            .populate("sender")
            .populate("repliedTo")
            .lean();

        return NextResponse.json({ success: true, message: populated });
    } catch (error) {
        console.log("Message PATCH error:", error);
        return NextResponse.json(
            { error: error || "Invalid input" },
            { status: 400 }
        );
    }
}
