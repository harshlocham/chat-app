import Message from "@/models/Message";
import { Types } from "mongoose";
import { IMessage } from "@/models/Message";
import { connectToDatabase } from "../Db/db";

/**
 * Fetches a page of messages for a conversation, ordered from newest to oldest.
 *
 * Queries messages for the given `conversationId` (as a MongoDB ObjectId string), optionally starting before the provided `cursor` message id, and returns up to `limit` messages sorted by descending `_id`.
 *
 * @param conversationId - Conversation id as a MongoDB ObjectId string
 * @param cursor - Optional message id (ObjectId string); when provided, only messages with `_id` less than this id are returned
 * @param limit - Maximum number of messages to return
 * @returns An array of plain message objects with the `sender` field populated (username, email, profilePicture, status, _id)
 */
export async function getPaginatedMessages(conversationId: string, cursor?: string, limit = 20) {
    const query: { conversationId: Types.ObjectId; _id?: { $lt: Types.ObjectId } } = { conversationId: new Types.ObjectId(conversationId) };
    if (cursor) {
        query._id = { $lt: new Types.ObjectId(cursor) };
    }
    connectToDatabase();

    const messages = await Message.find(query)
        .sort({ _id: -1 })
        .limit(limit)
        .populate("sender", "username email profilePicture status _id")
        .lean();

    return messages;
}
export async function saveMessage(data: Partial<IMessage>) {
    const message = new Message(data);
    await message.save();
    return message;
}