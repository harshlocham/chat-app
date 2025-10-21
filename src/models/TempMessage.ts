import { IUser } from "./User";

export interface ITempMessage {
    _id: string;
    conversationId: string;
    senderId: string;
    content: string;
    messageType: "text" | "image";
    createdAt: string;
    status: "pending" | "sent" | "failed";
    sender: IUser;
    timestamp: string;
}