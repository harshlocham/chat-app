
export type MessageType = "text" | "image" | "file" | "voice" | "video" | "audio";

export interface ReplyPreview {
    _id: string;
    content: string;
    senderId: string;
}

export interface ClientMessage {
    _id: string;
    conversationId: string;
    content: string;
    messageType: MessageType;
    sender: import("./user.js").ClientUser;
    repliedTo?: ReplyPreview | null;
    reactions?: Record<string, string[]>;
    seenBy?: string[];
    deliveredTo?: string[];
    createdAt: string;
    updatedAt?: string;
    isEdited: boolean;
    isDeleted: boolean;
}