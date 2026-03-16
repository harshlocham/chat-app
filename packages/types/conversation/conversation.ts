import type { Message } from "../message/message.js";
import type { ClientUser } from "../user/user.js";

export interface Conversation {
    _id: string;
    type: 'direct' | 'group';
    isGroup: boolean;
    admin?: string;
    name?: string;
    image?: string;
    groupName?: string;
    participants: ClientUser[];
    lastMessage?: Message;
    createdAt: string;
    updatedAt: string;
}