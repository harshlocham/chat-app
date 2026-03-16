export interface JoinConversationPayload {
    conversationId: string;
}

export interface LeaveConversationPayload {
    conversationId: string;
}

export interface SendMessagePayload {
    conversationId: string;
    tempId: string;
    content: string;
    type: "text" | "image" | "video" | "audio" | "voice" | "file";
    fileUrl?: string;
    repliedTo?: string | null;
}

export interface EditMessagePayload {
    messageId: string;
    content: string;
}

export interface DeleteMessagePayload {
    messageId: string;
}

export interface ReactMessagePayload {
    messageId: string;
    emoji: string;
}

export interface MessageDeletedPayload {
    messageId: string;
    conversationId: string;
}

export interface TypingUpdatePayload {
    conversationId: string;
    userId: string;
    isTyping: boolean;
}

export interface PresenceUpdatePayload {
    userId: string;
    status: "online" | "offline";
}

export interface MessageSendAckPayload {
    tempId: string;
    realId: string;
}

export interface MessageFailedPayload {
    tempId: string;
    reason: string;
}

export interface MessageRetryPayload {
    tempId: string;
    conversationId: string;
}

export interface MessageDeliveredPayload {
    messageId: string;
    conversationId: string;
    senderId?: string;
    at?: Date | string;
}

export interface MessageDeliveredUpdatePayload {
    messageId: string;
    conversationId: string;
    userId: string;
    deliveredAt: Date | string;
}

export interface MessageSeenPayload {
    conversationId: string;
    messageIds: string[];
    at?: Date | string;
}

export interface MessageSeenUpdatePayload {
    conversationId: string;
    messageIds: string[];
    userId: string;
    seenAt: Date | string;
}

export interface MessageEditPayload {
    messageId: string;
    text: string;
    conversationId: string;
}

export interface MessageDeletePayload {
    messageId: string;
    conversationId: string;
}

export interface MessageUnsendPayload {
    messageId: string;
}

export interface MessageReactionPayload {
    messageId: string;
    emoji: string;
}

export interface TypingPayload {
    conversationId: string;
    userId: string;
    conversationMembers?: string[];
    name?: string;
    avatar?: string;
}

export interface UserOnlinePayload {
    userId: string;
}

export interface UserOfflinePayload {
    userId: string;
    lastSeen: Date;
}

export interface UserIdlePayload {
    userId: string;
}

export interface UserActivePayload {
    userId: string;
}

export interface PresencePingPayload {
    at?: Date | string;
}

export interface CallOfferPayload {
    from: string;
    to: string;
    conversationId?: string;
    offer: RTCSessionDescriptionInit;
}

export interface CallAnswerPayload {
    from: string;
    to: string;
    answer: RTCSessionDescriptionInit;
}

export interface CallIceCandidatePayload {
    from: string;
    to: string;
    candidate: RTCIceCandidateInit;
}

export interface CallRingingPayload {
    from: string;
    to: string;
}

export interface CallEndPayload {
    from: string;
    to: string;
}

export interface CallReconnectPayload {
    from: string;
    to: string;
}

export interface ConversationJoinPayload {
    conversationId: string;
}

export interface ConversationLeavePayload {
    conversationId: string;
}

export interface ConversationJoinedPayload {
    conversationId: string;
    userId: string;
    at: Date;
}

export interface ConversationLeftPayload {
    conversationId: string;
    userId: string;
    at: Date;
}

export interface ConversationUpdatedPayload {
    conversationId: string;
    changes: {
        name?: string;
        image?: string;
        members?: string[];
    };
}

export interface SyncMessagesPayload {
    conversationId: string;
    since: Date;
}

export interface SyncConversationsPayload {
    userId: string;
}

export interface SyncStatusPayload {
    userId: string;
}

export interface SocketErrorPayload {
    type: string;
    message?: string;
    data?: unknown;
}

export interface DashboardInitPayload {
    activeUsers: number;
    totalMessagesToday: number;
}

export interface DashboardUpdatePayload {
    activeUsers?: number;
    totalMessagesToday?: number;
}