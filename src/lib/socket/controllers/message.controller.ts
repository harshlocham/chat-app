import * as messageService from "@/lib/services/message.service";
import { CreateMessageInput } from "@/lib/validators/message.schema";
import { Conversation } from "@/models/Conversation";

/**
 * Creates a message in the specified conversation on behalf of a sender.
 *
 * @param data - Message input containing at least `conversationId` and the message content
 * @param senderId - ID of the user sending the message
 * @returns The created message object
 * @throws Error when the conversation identified by `data.conversationId` does not exist
 */
export async function handleCreateMessage(data: CreateMessageInput, senderId: string) {

    // Optional: validate that conversation exists
    const conversation = await Conversation.findById(data.conversationId);
    if (!conversation) {
        throw new Error("Conversation not found");
    }

    // Delegate saving & emitting to the service
    return messageService.createMessage(data, senderId);
}