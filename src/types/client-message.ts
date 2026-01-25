import { ClientUser } from "./user.js";

export interface ClientReaction {
    emoji: string;
    users: string[];
}
export interface ClientMessage {
    _id: string;
    conversationId: string;

    content: string;
    messageType: "text" | "image" | "file" | "system" | "video" | "audio" | "voice";

    sender: Pick<ClientUser, "_id" | "username" | "profilePicture">;

    createdAt: Date;
    updatedAt?: Date;

    isDeleted?: boolean;
    isEdited?: boolean;
    reactions?: ClientReaction[];

    repliedTo?: {
        _id: string;
        content: string;
        sender: Pick<ClientUser, "_id" | "username" | "profilePicture">;
    } | null;
}