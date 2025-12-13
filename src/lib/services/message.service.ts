// src/lib/services/message.service.ts
import * as messageRepo from "@/lib/repositories/message.repo";
import { CreateMessageInput } from "../validators/ message.schema";
import { Types } from "mongoose";
import { Conversation } from "@/models/Conversation";
import Message from "@/models/Message";
//import { socket } from "@/lib/socket/socketClient";

export async function createMessage(data: CreateMessageInput, senderId: string) {
    // correctly map senderId → sender
    const toSave = {
        sender: new Types.ObjectId(senderId),
        conversationId: new Types.ObjectId(data.conversationId),
        content: data.content,
        messageType: data.messageType ?? "text",
    };
    const conversation = await Conversation.findById(data.conversationId);
    if (!conversation) {
        throw new Error("Conversation not found");
    }
    conversation.lastMessage = toSave;
    conversation.lastMessage._creationTime = new Date();
    await conversation.save();

    //console.log("🔊 [Service] Emitting to room", data.conversationId, toSave);
    //socket.emit("message:new", saved);
    return await messageRepo.saveMessage(toSave);
    // io.to(data.conversationId).emit("message:new", saved);

    // return saved;
}

interface Reaction {
    emoji: string;
    users: string[];
}
export async function updateMessageReaction({ messageId, emoji, userId }: { messageId: string; emoji: string; userId: string }) {
    const msg = await Message.findById(messageId);
    if (!msg) return null;

    const reaction = msg.reactions.find((r: Reaction) => r.emoji === emoji);

    if (reaction) {
        // Toggle 
        const index = reaction.users.findIndex(
            (u: string) => u.toString() === userId
        );

        if (index !== -1) reaction.users.splice(index, 1);
        else reaction.users.push(userId);
    } else {
        // New reaction
        msg.reactions.push({
            emoji,
            users: [userId],
        });
    }

    await msg.save();

    // Populate 
    return await msg.populate([
        { path: "sender", select: "username avatarUrl" },
        { path: "repliedTo", populate: { path: "sender" } },
    ]);
}
