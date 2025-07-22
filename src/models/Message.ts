// src/models/Message.ts
import mongoose, { Schema, Document, models } from "mongoose";

export interface IMessage extends Document {
    _id: mongoose.Types.ObjectId;
    sender: mongoose.Types.ObjectId | any; // user ref
    content: string;
    messageType: "text" | "image" | "video";
    timestamp: Date;
    conversationId: mongoose.Types.ObjectId;
    createdAt: Date;
}

const MessageSchema = new Schema<IMessage>({
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    messageType: {
        type: String,
        enum: ["text", "image", "video"],
        default: "text",
    },
    timestamp: { type: Date, default: Date.now },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
});

export default models.Message || mongoose.model<IMessage>("Message", MessageSchema);
