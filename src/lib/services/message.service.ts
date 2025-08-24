// src/lib/services/message.service.ts
import * as messageRepo from "@/lib/repositories/message.repo";
import { CreateMessageInput } from "../validators/ message.schema";
import { Types } from "mongoose";
import { Conversation } from "@/models/Conversation";

export async function createMessage(data: CreateMessageInput) {
    // correctly map senderId → sender
    const toSave = {
        sender: new Types.ObjectId(data.senderId),
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

    console.log("🔊 [Service] Emitting to room", data.conversationId, toSave);
    return await messageRepo.saveMessage(toSave);

    // io.to(data.conversationId).emit("message:new", saved);

    //return saved;
}
