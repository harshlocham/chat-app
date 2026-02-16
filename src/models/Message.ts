// src/models/Message.ts
import mongoose, { Schema } from "mongoose";
import { IUser } from "./User.js";

export type MessageType = "text" | "image" | "video" | "audio" | "voice" | "file";

export interface IReaction {
    emoji: string;
    users: mongoose.Types.ObjectId[] | (mongoose.Types.ObjectId | IUser)[];
}
export interface IDeliveredTo {
    userId: mongoose.Types.ObjectId;
    at: Date;
}

export interface IMessage {
    _id: mongoose.Types.ObjectId;
    sender: mongoose.Types.ObjectId; // populated or just id
    content: string;
    repliedTo?: mongoose.Types.ObjectId | IMessagePopulated;
    reactions?: IReaction[];
    isEdited: boolean;
    isDeleted: boolean;
    messageType: MessageType;
    conversationId: mongoose.Types.ObjectId;
    seenBy?: IDeliveredTo[];
    deliveredTo?: IDeliveredTo[];
    createdAt: Date;
    updatedAt?: Date;
}

// Fully populated version for FE usage
export interface IMessagePopulated extends Omit<IMessage, "sender" | "repliedTo"> {
    sender: IUser;
    repliedTo?: IMessagePopulated;
    createdAt: Date;
    updatedAt?: Date;
}

// For optimistic UI / temp messages
export interface ITempMessage extends Omit<IMessage, "_id" | "timestamp" | "createdAt"> { }
// Import from canonical location
//export { ITempMessage } from "./TempMessage";
export interface MessageInputProps {
    onSend: (content: string) => void;
    replyTo?: IMessage;
    onCancelReply?: () => void;
    editMessage?: IMessage;
    onCancelEdit?: () => void;
}
const DeliveredSchema = new Schema<IDeliveredTo>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        at: { type: Date, default: Date.now },
    },
    { _id: false }
);

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
    seenBy: {
        type: [DeliveredSchema],
        default: [],
    },
    deliveredTo: {
        type: [DeliveredSchema],
        default: [],
    },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
}, {
    timestamps: true,
});

export default mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
