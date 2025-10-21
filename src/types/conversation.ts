import { Types } from "mongoose";

export interface IUserBasic {
    _id: Types.ObjectId | string;
    username: string;
    email: string;
    profilePicture: string;
}

export interface ILastMessagePopulated {
    _id: Types.ObjectId | string;
    sender: IUserBasic;
    messageType: "text" | "image" | "video" | "file" | "system";
    content?: string;
    _creationTime: string; // or Date if you keep it as a Date
}

export interface IConversationResponse {
    _id: Types.ObjectId | string;
    participants: IUserBasic[];
    lastMessage?: ILastMessagePopulated | null;
    updatedAt: string;
    createdAt: string;
}