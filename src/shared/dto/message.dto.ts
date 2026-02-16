export interface MessageDTO {
    _id: string;
    conversationId: string;

    content: string;
    messageType: "text" | "image" | "file" | "system" | "video" | "audio" | "voice";

    sender: {
        _id: string;
        username: string;
        profilePicture?: string;
    };

    createdAt: string;   // ISO string
    updatedAt?: string;  // ISO string

    isDeleted?: boolean;
    isEdited?: boolean;
    editedAt?: string;

    reactions?: {
        emoji: string;
        users: string[];
    }[];

    seenBy?: string[];
    deliveredTo?: string[];

    repliedTo?: {
        _id: string;
        content: string;
        sender: {
            _id: string;
            username: string;
            profilePicture?: string;
        };
    } | null;
}