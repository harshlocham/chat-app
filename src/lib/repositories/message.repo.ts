import Message from "@/models/Message";
import { Types } from "mongoose";

export async function getPaginatedMessages(conversationId: string, cursor?: string, limit = 20) {
    const query: any = { conversationId: new Types.ObjectId(conversationId) };
    if (cursor) {
        query._id = { $lt: new Types.ObjectId(cursor) };
    }

    const messages = await Message.find(query)
        .sort({ _id: -1 })
        .limit(limit)
        .populate("sender", "name image _id")
        .lean();

    return messages;
}
export async function saveMessage(data: any) {
    const message = new Message(data);
    await message.save();
    return message;
}