import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/utils/auth/getAuthUser";
import { connectToDatabase } from "@/lib/Db/db";
import Message from "@/models/Message";
import { Conversation } from "@/models/Conversation";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        await connectToDatabase();
        const body = await req.json();
        const textToUpdate =
            (typeof body?.newText === "string" && body.newText.trim()) ||
            (typeof body?.text === "string" && body.text.trim()) ||
            "";

        if (!textToUpdate) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

        const message = await Message.findById(id);

        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        if (String(message.sender) !== authUser.id) {
            return NextResponse.json({ error: "Not allowed" }, { status: 403 });
        }

        message.content = textToUpdate;
        message.isEdited = true;
        await message.save();

        const conversation = await Conversation.findById(message.conversationId);
        if (
            conversation?.lastMessage?._id &&
            String(conversation.lastMessage._id) === String(message._id)
        ) {
            conversation.lastMessage.content = textToUpdate;
            await conversation.save();
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
            { error: error instanceof Error ? error.message : "Invalid input" },
            { status: 400 }
        );
    }
}
