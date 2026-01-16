// src/store/chat-store.ts
import { create } from "zustand";
import { IMessage, IMessagePopulated } from "@/models/Message";
import { ITempMessage } from "@/models/TempMessage";
type MessageType = IMessagePopulated | ITempMessage;
import { ClientConversation } from "@/types/client-conversation";
interface ChatStore {
    selectedConversationId: string | null;
    currentUserId: string | null;
    selectedConversation: ClientConversation | null;
    conversations: ClientConversation[];
    messagesByConversation: Record<string, MessageType[]>;
    hasMoreByConversation: Record<string, boolean>;
    onlineUsers: string[];
    typingByConversation: Record<string, string[]>; // conversationId -> userIds

    // setters
    setSelectedConversation: (conversation: ClientConversation | null) => void;
    setConversations: (convs: ClientConversation[]) => void;
    setHasMore: (conversationId: string, val: boolean) => void;
    setOnlineUsers: (users: string[]) => void;

    // messages
    setMessages: (
        conversationId: string,
        msgs: IMessagePopulated[],
        appendToTop?: boolean
    ) => void;

    addOptimisticMessage: (conversationId: string, msg: ITempMessage) => void;
    addMessage: (conversationId: string, msg: IMessagePopulated | ITempMessage) => void;
    replaceTempMessage: (
        conversationId: string,
        tempId: string,
        newMsg: IMessagePopulated
    ) => void;
    updateMessage: (conversationId: string, updated: IMessagePopulated) => void;
    removeMessage: (conversationId: string, messageId: string) => void;
    updateMessageReactions: (conversationId: string, updated: IMessagePopulated) => void;
    clearTempMessages: (conversationId: string) => void;
    updateEditedMessage: (conversationId: string, messageId: string, newText: string) => void;

    // conversation helpers
    updateLastMessage: (conversationId: string, msg: MessageType) => void;
    incrementUnread: (conversationId: string) => void;
    clearUnread: (conversationId: string) => void;
    receiveMessage: (payload: {
        conversationId: string;
        message: MessageType;
    }) => void;

    // typing
    setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
    editingMessage: IMessage | IMessagePopulated | ITempMessage | null;
    setEditingMessage: (msg: ChatStore['editingMessage']) => void;
    clearEditingMessage: () => void;
}

const idOf = (m: { _id: any } | string): string => {
    if (typeof m === "string") return m;
    if (!m || m._id === undefined || m._id === null) return "";
    return typeof m._id === "string" ? m._id : String(m._id);
};

const isTempId = (id: string) => id.startsWith("temp_");

const useChatStore = create<ChatStore>((set) => ({
    selectedConversationId: null,
    selectedConversation: null,
    conversations: [],
    messagesByConversation: {},
    hasMoreByConversation: {},
    onlineUsers: [],
    typingByConversation: {},
    currentUserId: null,

    setSelectedConversation: (conv) =>
        set({
            selectedConversationId: conv?._id ?? null,
            selectedConversation: conv,
        }),

    setConversations: (convs) => set({ conversations: convs }),
    setHasMore: (conversationId, val) =>
        set((state) => ({
            hasMoreByConversation: {
                ...state.hasMoreByConversation,
                [conversationId]: val,
            },
        })),
    setOnlineUsers: (users) => set({ onlineUsers: users }),

    setMessages: (conversationId, msgs, appendToTop = false) =>
        set((state) => {
            const prev = state.messagesByConversation[conversationId] || [];

            // server-confirmed ids
            const confirmedIds = new Set(msgs.map((m) => idOf(m)));

            // pick existing temp messages that server hasn't confirmed
            const tempMessages = prev.filter(
                (m) => isTempId(idOf(m)) && !confirmedIds.has(idOf(m))
            );

            // existing non-temp messages (we will merge server msgs with these)
            const existingNonTemp = prev.filter((m) => !isTempId(idOf(m)));

            // merge server msgs with existing non-temp (dedupe by id)
            const base = appendToTop ? [...msgs, ...existingNonTemp] : [...existingNonTemp, ...msgs];

            // append leftover temp messages at the end (so optimistic messages show until ack)
            const combined = [...base, ...tempMessages];

            // ensure uniqueness by id (preserve last occurrence)
            const unique = Array.from(
                new Map(combined.map((m) => [idOf(m), m])).values()
            ) as MessageType[];

            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: unique,
                },
            };
        }),

    addOptimisticMessage: (conversationId, msg) =>
        set((state) => {
            const current = state.messagesByConversation[conversationId] || [];
            const exists = current.some((m) => idOf(m) === idOf(msg));
            if (exists) return {};

            return {
                conversations: state.conversations.map((conv) =>
                    conv._id === conversationId
                        ? { ...conv, lastMessage: msg }
                        : conv
                ) as (ClientConversation & { unreadCount?: number })[],
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: [...current, msg],
                },
            };
        }),
    addMessage: (conversationId, msg) =>
        set((state) => {
            const current = state.messagesByConversation[conversationId] || [];
            const exists = current.some((m) => idOf(m) === idOf(msg));
            const selectedId = state.selectedConversationId;

            const conversations = state.conversations.map((conv) => {
                if (idOf(conv) !== conversationId) return conv;

                return {
                    ...conv,
                    lastMessage: msg, // ✅ ALWAYS update
                    unreadCount:
                        conversationId === selectedId
                            ? 0
                            : (conv.unreadCount || 0) + 1,
                };
            }) as (ClientConversation)[];

            if (exists) {
                return { conversations };
            }

            return {
                conversations,
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: [...current, msg],
                },
            };
        }),

    replaceTempMessage: (conversationId, tempId, realMessage) =>
        set((state) => {
            const current = state.messagesByConversation[conversationId] || [];

            const mapped = current.map((m) =>
                idOf(m) === tempId ? realMessage : m
            );

            return {
                conversations: state.conversations.map((conv) =>
                    conv._id === conversationId
                        ? { ...conv, lastMessage: realMessage }
                        : conv
                ) as (ClientConversation)[],
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: mapped,
                },
            };
        }),
    updateMessage: (conversationId, updated) =>
        set((state) => {
            const current = state.messagesByConversation[conversationId] || [];
            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: current.map((m) =>
                        idOf(m) === idOf(updated) ? updated : m
                    ),
                },
            };
        }),

    updateEditedMessage: (conversationId, messageId, newText) =>
        set((state) => {
            const messages = state.messagesByConversation[conversationId] || [];
            //  Update messages
            const updatedMessages = messages.map((m) =>
                idOf(m) === messageId
                    ? { ...m, content: newText, isEdited: true }
                    : m
            );

            //  ALWAYS recompute lastMessage safely
            const newLastMessage =
                updatedMessages.length > 0
                    ? updatedMessages[updatedMessages.length - 1]
                    : undefined;

            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: updatedMessages,
                },
                conversations: state.conversations.map((conv) =>
                    conv._id === conversationId
                        ? { ...conv, lastMessage: newLastMessage }
                        : conv
                ) as (ClientConversation)[],
            };
        }),

    removeMessage: (conversationId, messageId) =>
        set((state) => {
            const current = state.messagesByConversation[conversationId] || [];
            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: current.filter((m) => idOf(m) !== messageId),
                },
            };
        }),

    updateMessageReactions: (conversationId, updated) =>
        set((state) => {
            const current = state.messagesByConversation[conversationId] || [];
            const mapped = current.map((m) =>
                idOf(m) === idOf(updated) ? ({ ...m, reactions: updated.reactions } as MessageType) : m
            );
            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: mapped as MessageType[],
                },
            };
        }),

    clearTempMessages: (conversationId) =>
        set((state) => {
            const current = state.messagesByConversation[conversationId] || [];
            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: current.filter((m) => !isTempId(idOf(m))),
                },
            };
        }),

    updateLastMessage: (conversationId, message) =>
        set((state) => ({
            conversations: state.conversations.map((conv) =>
                conv._id === conversationId ? { ...conv, lastMessage: message } : conv
            ) as (ClientConversation)[],
        })),

    incrementUnread: (conversationId) =>
        set((state) => ({
            conversations: state.conversations.map((conv) =>
                conv._id === conversationId ? { ...conv, unreadCount: (conv.unreadCount || 0) + 1 } : conv
            ) as (ClientConversation)[],
        })),

    clearUnread: (conversationId) =>
        set((state) => ({
            conversations: state.conversations.map((conv) =>
                conv._id === conversationId ? { ...conv, unreadCount: 0 } : conv
            ) as (ClientConversation)[],
        })),

    setTyping: (conversationId, userId, isTyping) =>
        set((state) => {
            const current = state.typingByConversation[conversationId] || [];
            const setUsers = new Set(current);
            if (isTyping) setUsers.add(userId);
            else setUsers.delete(userId);
            return {
                typingByConversation: {
                    ...state.typingByConversation,
                    [conversationId]: Array.from(setUsers),
                },
            };
        }),
    editingMessage: null,

    setEditingMessage: (msg) => set({ editingMessage: msg }),
    clearEditingMessage: () => set({ editingMessage: null }),
    receiveMessage: ({ conversationId, message }) =>
        set((state) => {
            const existingMessages =
                state.messagesByConversation[conversationId] || [];

            // 1️⃣ Deduplicate safely
            if (existingMessages.some((m) => idOf(m) === idOf(message))) {
                return {};
            }

            const updatedMessages = [...existingMessages, message];

            const isOpen = state.selectedConversationId === conversationId;
            const senderId =
                typeof message.sender === "string"
                    ? message.sender
                    : String((message.sender as any)?._id);

            const isOwnMessage = senderId === state.currentUserId;

            // 2️⃣ Update conversations
            const updatedConversations = state.conversations.map((conv) => {
                if (idOf(conv) !== conversationId) return conv;

                return {
                    ...conv,
                    lastMessage: message,
                    unreadCount:
                        !isOpen && !isOwnMessage
                            ? (conv.unreadCount || 0) + 1
                            : conv.unreadCount || 0,
                };
            }) as ClientConversation[];

            // 3️⃣ Reorder conversation to top (safe)
            const target = updatedConversations.find(
                (c) => idOf(c) === conversationId
            );

            const reorderedConversations = target
                ? [
                    target,
                    ...updatedConversations.filter(
                        (c) => idOf(c) !== conversationId
                    ),
                ]
                : updatedConversations;

            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: updatedMessages,
                },
                conversations: reorderedConversations,
            };
        }),
}));

export default useChatStore;