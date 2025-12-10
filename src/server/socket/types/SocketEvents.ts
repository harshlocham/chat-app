
// SOCKET EVENT CONSTANTS -------------------*******************-------------------
import { IMessagePopulated } from "@/models/Message";

export const SocketEvents = {
    MESSAGE_NEW: "message:new",
    MESSAGE_DELIVERED: "message:delivered",
    MESSAGE_SEEN: "message:seen",
    MESSAGE_EDIT: "message:edit",
    MESSAGE_DELETE: "message:delete",
    MESSAGE_REACTION: "message:reaction",

    TYPING_START: "typing:start",
    TYPING_STOP: "typing:stop",

    USER_ONLINE: "user:online",
    USER_OFFLINE: "user:offline",

    CALL_OFFER: "call:offer",
    CALL_ANSWER: "call:answer",
    CALL_END: "call:end",
    CALL_BUSY: "call:busy",

    CONVERSATION_JOIN: "conversation:join",
    CONVERSATION_LEAVE: "conversation:leave",
} as const;


// =========================================
// UTILITY TYPE
// =========================================

export type ValueOf<T> = T[keyof T];

export type SocketEventName = ValueOf<typeof SocketEvents>;


// =========================================
// EVENT PAYLOAD TYPES
// =========================================

// ------------ MESSAGE EVENTS ------------

export interface MessageNewPayload {
    tempId?: string;
    conversationId: string;
    message: IMessagePopulated;    
}

export interface MessageDeliveredPayload {
    messageId: string;
    conversationId: string;
    userId: string;
    at: Date;
}

export interface MessageSeenPayload {
    conversationId: string;
    userId: string;
    at: Date;
}

export interface MessageEditPayload {
    messageId: string;
    text: string;
}

export interface MessageDeletePayload {
    messageId: string;
}

export interface MessageReactionPayload {
    messageId: string;
    emoji: string;
}


// ------------ TYPING EVENTS ------------

export interface TypingStartPayload {
    conversationId: string;
    userId: string;
}

export interface TypingStopPayload {
    conversationId: string;
    userId: string;
}


// ------------ PRESENCE EVENTS ------------

export interface UserOnlinePayload {
    userId: string;
}

export interface UserOfflinePayload {
    userId: string;
    lastSeen: Date;
}


// ------------ CALL EVENTS ------------

export interface CallOfferPayload {
    to: string;
    from: string;
    offer: RTCSessionDescriptionInit;
}

export interface CallAnswerPayload {
    to: string;
    from: string;
    answer: RTCSessionDescriptionInit;
}

export interface CallEndPayload {
    to: string;
    from: string;
}

export interface CallBusyPayload {
    to: string;
    from: string;
}


// ------------ CONVERSATION EVENTS ------------

export interface ConversationJoinPayload {
    conversationId: string;
}

export interface ConversationLeavePayload {
    conversationId: string;
}


//  ##################################################################
// SERVER → CLIENT EVENT MAP
//  ##################################################################

export interface ServerToClientEvents {
    [SocketEvents.MESSAGE_NEW]: (data: MessageNewPayload) => void;
    [SocketEvents.MESSAGE_DELIVERED]: (data: MessageDeliveredPayload) => void;
    [SocketEvents.MESSAGE_SEEN]: (data: MessageSeenPayload) => void;
    [SocketEvents.MESSAGE_EDIT]: (data: MessageEditPayload) => void;
    [SocketEvents.MESSAGE_DELETE]: (data: MessageDeletePayload) => void;
    [SocketEvents.MESSAGE_REACTION]: (data: MessageReactionPayload) => void;

    [SocketEvents.TYPING_START]: (data: TypingStartPayload) => void;
    [SocketEvents.TYPING_STOP]: (data: TypingStopPayload) => void;

    [SocketEvents.USER_ONLINE]: (data: UserOnlinePayload) => void;
    [SocketEvents.USER_OFFLINE]: (data: UserOfflinePayload) => void;

    [SocketEvents.CALL_OFFER]: (data: CallOfferPayload) => void;
    [SocketEvents.CALL_ANSWER]: (data: CallAnswerPayload) => void;
    [SocketEvents.CALL_END]: (data: CallEndPayload) => void;
    [SocketEvents.CALL_BUSY]: (data: CallBusyPayload) => void;
}


// ##################################################################
// CLIENT → SERVER EVENT MAP
// ##################################################################



export interface ClientToServerEvents {
    [SocketEvents.MESSAGE_NEW]: (data: MessageNewPayload) => void;
    [SocketEvents.MESSAGE_DELIVERED]: (data: MessageDeliveredPayload) => void;
    [SocketEvents.MESSAGE_SEEN]: (data: MessageSeenPayload) => void;
    [SocketEvents.MESSAGE_EDIT]: (data: MessageEditPayload) => void;
    [SocketEvents.MESSAGE_DELETE]: (data: MessageDeletePayload) => void;
    [SocketEvents.MESSAGE_REACTION]: (data: MessageReactionPayload) => void;

    [SocketEvents.TYPING_START]: (data: TypingStartPayload) => void;
    [SocketEvents.TYPING_STOP]: (data: TypingStopPayload) => void;

    [SocketEvents.CALL_OFFER]: (data: CallOfferPayload) => void;
    [SocketEvents.CALL_ANSWER]: (data: CallAnswerPayload) => void;
    [SocketEvents.CALL_END]: (data: CallEndPayload) => void;
    [SocketEvents.CALL_BUSY]: (data: CallBusyPayload) => void;

    [SocketEvents.CONVERSATION_JOIN]: (data: ConversationJoinPayload) => void;
    [SocketEvents.CONVERSATION_LEAVE]: (data: ConversationLeavePayload) => void;
}