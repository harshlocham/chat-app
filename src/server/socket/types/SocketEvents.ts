// ============================================================================
// SOCKET EVENT CONSTANTS

import mongoose from "mongoose";

// ============================================================================
//  interface IReaction {
//     emoji: string;
//     users: mongoose.Types.ObjectId[] | (mongoose.Types.ObjectId | IUser)[];
// }
interface IMessagePopulated {
    _id: mongoose.Types.ObjectId;
    sender: mongoose.Types.ObjectId; // populated or just id
    content: string;
    repliedTo?: mongoose.Types.ObjectId | IMessagePopulated;
    //reactions?: IReaction[];
    isEdited: boolean;
    isDeleted: boolean;
    //messageType: MessageType;
    timestamp: Date;
    conversationId: mongoose.Types.ObjectId;
    createdAt: Date;
    seenBy?: mongoose.Types.ObjectId[];
    deliveredTo?: mongoose.Types.ObjectId[];
}
export const SocketEvents = {
    // ---------- MESSAGE ----------
    MESSAGE_NEW: "message:new",
    MESSAGE_SEND: "message:send",
    MESSAGE_SEND_ACK: "message:send:ack",
    MESSAGE_FAILED: "message:failed",
    MESSAGE_RETRY: "message:retry",

    MESSAGE_DELIVERED: "message:delivered",           // client → server
    MESSAGE_DELIVERED_UPDATE: "message:delivered:update", // server → clients

    MESSAGE_SEEN: "message:seen",                    // client → server
    MESSAGE_SEEN_UPDATE: "message:seen:update",      // server → clients

    MESSAGE_EDIT: "message:edit",
    MESSAGE_EDITED: "message:edited",
    MESSAGE_DELETE: "message:delete",
    MESSAGE_UNSEND: "message:unsend",                // delete for everyone
    MESSAGE_REACTION: "message:reaction",

    // ---------- TYPING ----------
    TYPING_START: "typing:start",
    TYPING_STOP: "typing:stop",

    // ---------- PRESENCE ----------
    USER_ONLINE: "user:online",
    USER_OFFLINE: "user:offline",
    USER_IDLE: "user:idle",
    USER_ACTIVE: "user:active",

    // ---------- CALL ----------
    CALL_OFFER: "call:offer",
    CALL_ANSWER: "call:answer",
    CALL_ICE_CANDIDATE: "call:ice-candidate",
    CALL_RINGING: "call:ringing",
    CALL_BUSY: "call:busy",
    CALL_END: "call:end",
    CALL_RECONNECT: "call:reconnect",

    // ---------- CONVERSATION ----------
    CONVERSATION_JOIN: "conversation:join",
    CONVERSATION_LEAVE: "conversation:leave",
    CONVERSATION_JOINED: "conversation:joined",  // server → others
    CONVERSATION_LEFT: "conversation:left",
    CONVERSATION_UPDATED: "conversation:updated",

    // ---------- SYNC ----------
    SYNC_MESSAGES: "sync:messages",
    SYNC_CONVERSATIONS: "sync:conversations",
    SYNC_STATUS: "sync:status",

    // ---------- ERRORS ----------
    ERROR_GENERIC: "error:generic",
    ERROR_MESSAGE: "error:message",
    ERROR_CALL: "error:call",
    ERROR_AUTH: "error:auth",
    // admin

} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];
export type ValueOf<T> = T[keyof T];


// ============================================================================
// PAYLOAD TYPES
// ============================================================================

// ---------- MESSAGE ----------

export interface MessageNewPayload {
    tempId?: string;
    conversationId: string;
    message: IMessagePopulated;
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
    userId: string;
    at: Date;
}

export interface MessageDeliveredUpdatePayload {
    messageId: string;
    userId: string;
    deliveredAt: Date;
}

export interface MessageSeenPayload {
    messageId: string;
    conversationId: string;
    userId: string;
    at: Date;
}

export interface MessageSeenUpdatePayload {
    messageId: string;
    userId: string;
    seenAt: Date;
}

export interface MessageEditPayload {
    messageId: string;
    text: string;
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
    userId: string;
}


// ---------- TYPING ----------

export interface TypingPayload {
    conversationId: string;
    userId: string;
    name?: string;
    avatar?: string;
}


// ---------- PRESENCE ----------

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


// ---------- CALL (WebRTC) ----------

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


// ---------- CONVERSATION ----------

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


// ---------- SYNC ----------

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


// ---------- ERRORS ----------

export interface SocketErrorPayload {
    type: string;
    message?: string;
    data?: any;
}


// ============================================================================
// SERVER → CLIENT MAP
// ============================================================================

export interface ServerToClientEvents {
    // Messages
    [SocketEvents.MESSAGE_NEW]: (data: MessageNewPayload) => void;
    [SocketEvents.MESSAGE_SEND_ACK]: (data: MessageSendAckPayload) => void;
    [SocketEvents.MESSAGE_FAILED]: (data: MessageFailedPayload) => void;
    [SocketEvents.MESSAGE_DELIVERED_UPDATE]: (data: MessageDeliveredUpdatePayload) => void;
    [SocketEvents.MESSAGE_SEEN_UPDATE]: (data: MessageSeenUpdatePayload) => void;
    [SocketEvents.MESSAGE_EDIT]: (data: MessageEditPayload) => void;
    [SocketEvents.MESSAGE_EDITED]: (data: IMessagePopulated) => void;
    [SocketEvents.MESSAGE_DELETE]: (data: MessageDeletePayload) => void;
    [SocketEvents.MESSAGE_UNSEND]: (data: MessageUnsendPayload) => void;
    [SocketEvents.MESSAGE_REACTION]: (data: MessageReactionPayload) => void;

    // Typing
    [SocketEvents.TYPING_START]: (data: TypingPayload) => void;
    [SocketEvents.TYPING_STOP]: (data: TypingPayload) => void;

    // Presence
    [SocketEvents.USER_ONLINE]: (data: UserOnlinePayload) => void;
    [SocketEvents.USER_OFFLINE]: (data: UserOfflinePayload) => void;
    [SocketEvents.USER_IDLE]: (data: UserIdlePayload) => void;
    [SocketEvents.USER_ACTIVE]: (data: UserActivePayload) => void;

    // Call
    [SocketEvents.CALL_OFFER]: (data: CallOfferPayload) => void;
    [SocketEvents.CALL_ANSWER]: (data: CallAnswerPayload) => void;
    [SocketEvents.CALL_ICE_CANDIDATE]: (data: CallIceCandidatePayload) => void;
    [SocketEvents.CALL_RINGING]: (data: CallRingingPayload) => void;
    [SocketEvents.CALL_BUSY]: (data: CallRingingPayload) => void;
    [SocketEvents.CALL_RECONNECT]: (data: CallReconnectPayload) => void;
    [SocketEvents.CALL_END]: (data: CallEndPayload) => void;

    // Conversation
    [SocketEvents.CONVERSATION_JOINED]: (data: ConversationJoinedPayload) => void;
    [SocketEvents.CONVERSATION_LEFT]: (data: ConversationLeftPayload) => void;
    [SocketEvents.CONVERSATION_UPDATED]: (data: ConversationUpdatedPayload) => void;

    // Sync
    [SocketEvents.SYNC_MESSAGES]: (data: SyncMessagesPayload) => void;
    [SocketEvents.SYNC_CONVERSATIONS]: (data: SyncConversationsPayload) => void;
    [SocketEvents.SYNC_STATUS]: (data: SyncStatusPayload) => void;

    // Errors
    [SocketEvents.ERROR_GENERIC]: (data: SocketErrorPayload) => void;
    [SocketEvents.ERROR_MESSAGE]: (data: SocketErrorPayload) => void;
    [SocketEvents.ERROR_CALL]: (data: SocketErrorPayload) => void;
    [SocketEvents.ERROR_AUTH]: (data: SocketErrorPayload) => void;
}


// ============================================================================
// CLIENT → SERVER MAP
// ============================================================================

export interface ClientToServerEvents {
    // Messages
    [SocketEvents.MESSAGE_SEND]: (data: MessageNewPayload) => void;
    //[SocketEvents.MESSAGE_NEW]: (data: MessageNewPayload) => void;
    [SocketEvents.MESSAGE_RETRY]: (data: MessageRetryPayload) => void;
    [SocketEvents.MESSAGE_DELIVERED]: (data: MessageDeliveredPayload) => void;
    [SocketEvents.MESSAGE_SEEN]: (data: MessageSeenPayload) => void;
    [SocketEvents.MESSAGE_EDIT]: (data: MessageEditPayload) => void;
    [SocketEvents.MESSAGE_DELETE]: (data: MessageDeletePayload) => void;
    [SocketEvents.MESSAGE_UNSEND]: (data: MessageUnsendPayload) => void;
    [SocketEvents.MESSAGE_REACTION]: (data: MessageReactionPayload) => void;

    // Typing
    [SocketEvents.TYPING_START]: (data: TypingPayload) => void;
    [SocketEvents.TYPING_STOP]: (data: TypingPayload) => void;

    // Calls
    [SocketEvents.CALL_OFFER]: (data: CallOfferPayload) => void;
    [SocketEvents.CALL_ANSWER]: (data: CallAnswerPayload) => void;
    [SocketEvents.CALL_ICE_CANDIDATE]: (data: CallIceCandidatePayload) => void;
    [SocketEvents.CALL_END]: (data: CallEndPayload) => void;
    [SocketEvents.CALL_BUSY]: (data: CallRingingPayload) => void;

    // Conversation
    [SocketEvents.CONVERSATION_JOIN]: (data: ConversationJoinPayload) => void;
    [SocketEvents.CONVERSATION_LEAVE]: (data: ConversationLeavePayload) => void;

    // Sync
    [SocketEvents.SYNC_MESSAGES]: (data: SyncMessagesPayload) => void;

    // Error reporting (optional)
    [SocketEvents.ERROR_GENERIC]?: (data: SocketErrorPayload) => void;
}