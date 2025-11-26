// src/store/chat-store.ts
import { create } from "zustand";
import { IConversation, IConversationPopulated } from "@/models/Conversation";
import { IMessagePopulated } from "@/models/Message";
import { ITempMessage } from "@/models/TempMessage";

type MessageType = IMessagePopulated | ITempMessage;

interface ChatStore {
    selectedConversation: IConversationPopulated | null;
    conversations: (IConversation & { unreadCount?: number })[];
    messagesByConversation: Record<string, MessageType[]>;
    hasMoreByConversation: Record<string, boolean>;
    onlineUsers: string[];
    typingByConversation: Record<string, string[]>; // conversationId -> userIds

    // setters
    setSelectedConversation: (conversation: IConversationPopulated | null) => void;
    setConversations: (convs: IConversation[]) => void;
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

    // conversation helpers
    updateLastMessage: (conversationId: string, msg: MessageType) => void;
    incrementUnread: (conversationId: string) => void;
    clearUnread: (conversationId: string) => void;

    // typing
    setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
}

const useChatStore = create<ChatStore>((set, get) => ({
    selectedConversation: null,
    conversations: [],
    messagesByConversation: {},
    hasMoreByConversation: {},
    onlineUsers: [],
    typingByConversation: {},

    setSelectedConversation: (conversation) => {
        set((state) => ({
            selectedConversation: conversation,
            conversations: state.conversations.map((c) =>
                c._id.toString() === conversation?._id.toString()
                    ? { ...c, unreadCount: 0 }
                    : c
            ) as (IConversation & { unreadCount?: number })[],
        }));
    },

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

            const confirmedIds = new Set(msgs.map((m) => m._id.toString()));
            const tempMessages = prev.filter(
                (m) =>
                    m._id.toString().startsWith("temp_") &&
                    !confirmedIds.has(m._id.toString())
            );

            const withoutTemp = prev.filter(
                (m) => !m._id.toString().startsWith("temp_")
            );

            const merged = appendToTop
                ? [...msgs, ...withoutTemp]
                : [...withoutTemp, ...msgs];

            const combined = [...merged, ...tempMessages];

            const unique = Array.from(
                new Map(combined.map((m) => [m._id.toString(), m])).values()
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
            const exists = current.some(
                (m) => m._id.toString() === msg._id.toString()
            );
            if (exists) return {};
            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: [...current, msg],
                },
            };
        }),

    addMessage: (conversationId, msg) =>
        set((state) => {
            const current = state.messagesByConversation[conversationId] || [];
            const exists = current.some(
                (m) => m._id.toString() === msg._id.toString()
            );
            const selectedId = state.selectedConversation?._id.toString();

            let updatedConversations = state.conversations as (IConversation & { unreadCount?: number })[];

            if (conversationId !== selectedId) {
                updatedConversations = state.conversations
                    .map((conv) =>
                        conv._id.toString() === conversationId
                            ? { ...(conv as IConversation & { unreadCount?: number }), unreadCount: (conv.unreadCount || 0) + 1 }
                            : (conv as IConversation & { unreadCount?: number })
                    ) as (IConversation & { unreadCount?: number })[];
            }

            if (exists)
                return {
                    conversations: updatedConversations,
                };

            return {
                conversations: updatedConversations,
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
                m._id.toString() === tempId ? realMessage : m
            );
            const exists = mapped.some(
                (m) => m._id.toString() === realMessage._id.toString()
            );
            if (!exists) mapped.push(realMessage);

            return {
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
                        m._id.toString() === updated._id.toString() ? updated : m
                    ),
                },
            };
        }),

    removeMessage: (conversationId, messageId) =>
        set((state) => {
            const current = state.messagesByConversation[conversationId] || [];
            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: current.filter(
                        (m) => m._id.toString() !== messageId
                    ),
                },
            };
        }),

    updateMessageReactions: (conversationId, updated) =>
        set((state) => {
            const current = state.messagesByConversation[conversationId] || [];
            const mapped = current.map((m) =>
                m._id.toString() === updated._id.toString()
                    ? ({ ...m, reactions: updated.reactions } as MessageType)
                    : m
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
                    [conversationId]: current.filter(
                        (m) => !m._id.toString().startsWith("temp_")
                    ),
                },
            };
        }),

    updateLastMessage: (conversationId, message) =>
        set((state) => ({
            conversations: state.conversations.map((conv) =>
                conv._id.toString() === conversationId
                    ? { ...conv, lastMessage: message }
                    : conv
            ) as (IConversation & { unreadCount?: number })[],
        })),

    incrementUnread: (conversationId) =>
        set((state) => ({
            conversations: state.conversations.map((conv) =>
                conv._id.toString() === conversationId
                    ? { ...conv, unreadCount: (conv.unreadCount || 0) + 1 }
                    : conv
            ) as (IConversation & { unreadCount?: number })[],
        })),

    clearUnread: (conversationId) =>
        set((state) => ({
            conversations: state.conversations.map((conv) =>
                conv._id.toString() === conversationId
                    ? { ...conv, unreadCount: 0 }
                    : conv
            ) as (IConversation & { unreadCount?: number })[],
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
}));

export default useChatStore;