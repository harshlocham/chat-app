// src/models/Message.ts
import mongoose, { Schema, Model } from "mongoose";
import { IUser } from "./User.js";

export type MessageType = "text" | "image" | "video" | "audio" | "voice" | "file";

// Deprecated: IReaction interface (use reactions map instead)
// export interface IReaction {
//     emoji: string;
//     users: (mongoose.Types.ObjectId | IUser)[];
// }
export interface IDeliveredTo {
    userId: mongoose.Types.ObjectId;
    at: Date;
}

export interface IMessage {
    _id: mongoose.Types.ObjectId;
    sender: mongoose.Types.ObjectId; // populated or just id
    content: string;
    repliedTo?: mongoose.Types.ObjectId | IMessagePopulated;
    reactions?: {
        [emoji: string]: mongoose.Types.ObjectId[];
    };
    isEdited: boolean;
    isDeleted: boolean;
    messageType: MessageType;
    conversationId: mongoose.Types.ObjectId;
    seenBy?: IDeliveredTo[];
    deliveredTo?: IDeliveredTo[];
    createdAt: Date;
    delivered?: boolean;
    seen?: boolean;
    status: "pending" | "failed" | "sent" | "delivered" | "seen" | "queued";
    updatedAt?: Date;
}

// Fully populated version for FE usage
export interface IMessagePopulated extends Omit<IMessage, "sender" | "repliedTo"> {
    sender: IUser;
    repliedTo?: IMessagePopulated;
    createdAt: Date;
    updatedAt?: Date;
}

// MIGRATION NOTE:
// If you have existing messages with the old reactions array format,
// write a migration script to convert:
//   [{ emoji, users: [userId, ...] }]  =>  { [emoji]: [userId, ...] }
// This enables atomic updates and efficient grouping.

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
    reactions: {
        type: Map,
        of: [{ type: Schema.Types.ObjectId, ref: "User" }],
        default: {},
    },
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    messageType: {
        type: String,
        enum: ["text", "image", "video", "audio", "voice", "file"],
        default: "text",
    },
    status: {
        type: String,
        enum: ["pending", "failed", "sent", "delivered", "seen", "queued"],
        default: "pending",
    },
    delivered: {
        type: Boolean,
        default: false,
    },
    seen: {
        type: Boolean,
        default: false,
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

const MessageModel: Model<IMessage> =
    (mongoose.models.Message as Model<IMessage>) ||
    mongoose.model<IMessage>("Message", MessageSchema);

export default MessageModel;
