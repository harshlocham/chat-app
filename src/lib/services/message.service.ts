// src/lib/services/message.service.ts
'use server';
import * as messageRepo from "@/lib/repositories/message.repo";
import { CreateMessageInput } from "../validators/message.schema";
import { Types } from "mongoose";
import { Conversation } from "@/models/Conversation";
import Message from "@/models/Message";
/**
 * Create and persist a new message and set it as the conversation's lastMessage.
 *
 * @param data - Input containing `conversationId`, `content`, and optional `messageType`
 * @param senderId - ID of the user sending the message; recorded as the message sender
 * @returns The saved message document
 * @throws Error when the conversation identified by `data.conversationId` does not exist
 */

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
    //console.log("🔊 [Service] Emitting to room", data.conversationId, toSave);
    //socket.emit("message:new", saved);
    const saved = await messageRepo.saveMessage(toSave);
    conversation.lastMessage = saved;
    await conversation.save();

    return saved;
}

interface Reaction {
    emoji: string;
    users: string[];
}
/**
 * Toggle or add a reaction emoji for a message on behalf of a user.
 *
 * Looks up the message by `messageId`, toggles the presence of `userId` in the reaction for `emoji`
 * (adds the user if not present, removes if present), or creates a new reaction if none exists.
 *
 * @param messageId - The ID of the message to update
 * @param emoji - The emoji to toggle or add as a reaction
 * @param userId - The ID of the user performing the reaction
 * @returns The updated message document populated with `sender` (username, avatarUrl) and `repliedTo` (with its sender), or `null` if the message was not found
 */
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
    const updated = await Message.findById(messageId)
        .populate([
            { path: "sender", select: "username avatarUrl" },
            { path: "repliedTo", populate: { path: "sender" } },
        ])
        .lean();
    return updated;
}
/**
 * Update a message's content, mark it as edited, and return the message populated with sender and replied-to data.
 *
 * @param messageId - The ID of the message to update
 * @param text - The new message text
 * @returns The updated message document populated with `sender` (username, avatarUrl) and `repliedTo` (with its `sender`), or `null` if no message with `messageId` exists
 */
export async function editMessageById(messageId: string, text: string) {
    const msg = await Message.findById(messageId);
    if (!msg) return null;

    msg.content = text;
    msg.isEdited = true;
    await msg.save();

    // Populate 
    const updated = await Message.findById(messageId)
        .populate([
            { path: "sender", select: "username avatarUrl" },
            { path: "repliedTo", populate: { path: "sender" } },
        ])
        .lean();

    return updated;
}