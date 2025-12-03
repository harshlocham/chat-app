// src/models/Message.ts
import mongoose, { Schema, models } from "mongoose";
import { IUser } from "./User";

export type MessageType = "text" | "image" | "video" | "audio" | "voice" | "file";

export interface IReaction {
    emoji: string;
    users: mongoose.Types.ObjectId[] | (mongoose.Types.ObjectId | IUser)[];
}

export interface IMessage {
    _id: mongoose.Types.ObjectId;
    sender: mongoose.Types.ObjectId | IUser; // populated or just id
    content: string;
    repliedTo?: mongoose.Types.ObjectId | IMessagePopulated;
    reactions?: IReaction[];
    isEdited: boolean;
    isDeleted: boolean;
    messageType: MessageType;
    timestamp: Date;
    conversationId: mongoose.Types.ObjectId;
    createdAt: Date;
    seenBy?: mongoose.Types.ObjectId[];
}

// Fully populated version for FE usage
export interface IMessagePopulated extends Omit<IMessage, "sender" | "repliedTo"> {
    sender: IUser;
    repliedTo?: IMessagePopulated;
}

// For optimistic UI / temp messages
export interface ITempMessage extends Omit<IMessage, "_id" | "timestamp" | "createdAt"> {
    _id: string; // temp string id
    timestamp: Date | string;
    createdAt: Date | string;
    isTemp?: boolean;
}
export interface MessageInputProps {
    onSend: (content: string) => void;
    replyTo?: IMessage;
    onCancelReply?: () => void;
    editMessage?: IMessage;
    onCancelEdit?: () => void;
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
        enum: ["text", "image", "video", "audio", "voice", "file"],
        default: "text",
    },
    timestamp: { type: Date, default: Date.now },
    seenBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
});

export default models.Message || mongoose.model<IMessage>("Message", MessageSchema);
