import mongoose from "mongoose";
import { IUser } from "./User";

export interface ITempMessage {
    _id: string;
    conversationId: string;
    senderId: string;
    isDeleted: boolean;
    repliedTo?: mongoose.Types.ObjectId;
    reactions?: {
        emoji: string;
        users: mongoose.Types.ObjectId[]; // who reacted
    }[];
    content: string;
    messageType: "text" | "image";
    createdAt: string;
    status: "pending" | "queued";
    sender: IUser;
    timestamp: string;
}