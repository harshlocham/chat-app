// src/models/Message.ts
import mongoose, { Schema, Document, models, mongo } from "mongoose";
import { IUser } from "./User";

export interface IMessage extends Document {
    _id: mongoose.Types.ObjectId;
    sender: mongoose.Types.ObjectId; // user ref
    content: string;
    repliedTo?: mongoose.Types.ObjectId;
    reactions?: {
        emoji: string;
        users: mongoose.Types.ObjectId[]; // who reacted
    }[];
    isEdited: boolean;
    isDeleted: boolean;
    messageType: "text" | "image" | "video";
    timestamp: Date;
    conversationId: mongoose.Types.ObjectId;
    createdAt: Date;
}

export interface IMessagePopulated extends Omit<IMessage, 'sender'> {
    sender: IUser;
}

const MessageSchema = new Schema<IMessage>({
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    repliedTo: { type: Schema.Types.ObjectId, ref: "Message" },
    reactions: [
        {
            emoji: String,
            users: [{ type: Schema.Types.ObjectId, ref: "User" }],
        },
    ],
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    messageType: {
        type: String,
        enum: ["text", "image", "video"],
        default: "text",
    },
    timestamp: { type: Date, default: Date.now },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
});

export default models.Message || mongoose.model<IMessage>("Message", MessageSchema);
