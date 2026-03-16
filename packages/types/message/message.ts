import type { ClientUser } from "../user/user.js";

export type MessageType = "text" | "image" | "file" | "voice" | "video" | "audio";

export interface ReplyPreview {
    _id: string;
    content: string;
    senderId: string;
}

export interface Message {
    _id: string;
    conversationId: string;
    content: string;
    messageType: MessageType;
    sender: ClientUser;
    repliedTo?: ReplyPreview | null;
    reactions?: Record<string, string[]>;
    seenBy?: string[];
    deliveredTo?: string[];
    createdAt: string;
    updatedAt?: string;
    isEdited: boolean;
    isDeleted: boolean;
    delivered?: boolean;
    seen?: boolean;
}