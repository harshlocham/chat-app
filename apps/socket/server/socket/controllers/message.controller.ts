import * as messageService from "@/lib/services/message.service";
import { CreateMessageInput } from "@/lib/validators/message.schema";
import { Conversation } from "@/models/Conversation";

export async function handleCreateMessage(data: CreateMessageInput, senderId: string) {

    // Optional: validate that conversation exists
    const conversation = await Conversation.findById(data.conversationId);
    if (!conversation) {
        throw new Error("Conversation not found");
    }

    // Delegate saving & emitting to the service
    return messageService.createMessage(data, senderId);
}
