// src/store/chat-store.ts
import { create } from "zustand";
import { IConversation, IConversationPopulated } from "@/models/Conversation";
import { IMessage, IMessagePopulated } from "@/models/Message";
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
    selectedConversation: null,
    conversations: [],
    messagesByConversation: {},
    hasMoreByConversation: {},
    onlineUsers: [],
    typingByConversation: {},

    setSelectedConversation: (conversation) => {
        set((state) => {
            // if conversation is null, just set selectedConversation null (don't touch unread counts)
            if (!conversation) {
                return { selectedConversation: null };
            }

            const convId = idOf(conversation);
            return {
                selectedConversation: conversation,
                conversations: state.conversations.map((c) =>
                    idOf(c) === convId ? { ...c, unreadCount: 0 } : c
                ) as (IConversation & { unreadCount?: number })[],
            };
        });
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
            if (exists) return {}; // no-op
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
            const exists = current.some((m) => idOf(m) === idOf(msg));
            const selectedId = state.selectedConversation ? idOf(state.selectedConversation) : undefined;

            let updatedConversations = state.conversations as (IConversation & { unreadCount?: number })[];

            if (conversationId !== selectedId) {
                updatedConversations = state.conversations.map((conv) =>
                    idOf(conv) === conversationId
                        ? { ...(conv as IConversation & { unreadCount?: number }), unreadCount: (conv.unreadCount || 0) + 1 }
                        : (conv as IConversation & { unreadCount?: number })
                ) as (IConversation & { unreadCount?: number })[];
            }

            if (exists) {
                // message already present (could be temp or real) — only update conversations
                return {
                    conversations: updatedConversations,
                };
            }

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
            // replace the temp entry if exists, otherwise just append the real message
            let replaced = false;
            const mapped = current
                .map((m) => {
                    if (idOf(m) === tempId) {
                        replaced = true;
                        return realMessage;
                    }
                    return m;
                })
                // remove any remaining temp duplicates of the same real id
                .filter((m) => !(isTempId(idOf(m)) && idOf(m) === tempId));

            const alreadyHasReal = mapped.some((m) => idOf(m) === idOf(realMessage));
            if (!alreadyHasReal) mapped.push(realMessage);

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
                        idOf(m) === idOf(updated) ? updated : m
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
                idOf(conv) === conversationId ? { ...conv, lastMessage: message } : conv
            ) as (IConversation & { unreadCount?: number })[],
        })),

    incrementUnread: (conversationId) =>
        set((state) => ({
            conversations: state.conversations.map((conv) =>
                idOf(conv) === conversationId ? { ...conv, unreadCount: (conv.unreadCount || 0) + 1 } : conv
            ) as (IConversation & { unreadCount?: number })[],
        })),

    clearUnread: (conversationId) =>
        set((state) => ({
            conversations: state.conversations.map((conv) =>
                idOf(conv) === conversationId ? { ...conv, unreadCount: 0 } : conv
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
    editingMessage: null,

    setEditingMessage: (msg) => set({ editingMessage: msg }),
    clearEditingMessage: () => set({ editingMessage: null }),
}));

export default useChatStore;