// src/store/chat-store.ts
import { create } from "zustand";
import { ClientConversation } from "@/shared/types/client-conversation";
import { UIMessage } from "@/shared/types/ui-message";
interface ChatStore {
    selectedConversationId: string | null;
    currentUserId: string | null;
    selectedConversation: ClientConversation | null;
    conversations: ClientConversation[];
    messagesByConversation: Record<string, UIMessage[]>;
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
        msgs: UIMessage[],
        appendToTop?: boolean
    ) => void;

    addOptimisticMessage: (conversationId: string, msg: UIMessage) => void;
    addMessage: (conversationId: string, msg: UIMessage) => void;
    replaceTempMessage: (
        conversationId: string,
        tempId: string,
        newMsg: UIMessage
    ) => void;
    updateMessage: (updatedMessage: UIMessage) => void;
    removeMessage: (conversationId: string, messageId: string) => void;
    updateMessageReactions: (conversationId: string, updated: UIMessage) => void;
    clearTempMessages: (conversationId: string) => void;
    updateEditedMessage: (conversationId: string, messageId: string, newText: string) => void;
    updateDeletedMessage: (message: UIMessage) => void;
    repliedTo: Record<string, UIMessage | null>;

    // conversation helpers
    updateLastMessage: (conversationId: string, msg: UIMessage) => void;
    incrementUnread: (conversationId: string) => void;
    clearUnread: (conversationId: string) => void;
    receiveMessage: (
        message: UIMessage
    ) => void;

    // typing
    setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
    editingMessage: UIMessage | null;
    setEditingMessage: (msg: ChatStore['editingMessage']) => void;
    clearEditingMessage: () => void;
}

const idOf = (
    m: { _id?: string | { toString(): string } } | string | null | undefined
): string => {
    if (typeof m === "string") return m;
    if (!m || m._id == null) return "";
    const id = m._id;
    return typeof id === "string" ? id : id.toString();
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
            selectedConversationId: conv?._id ? String(conv._id) : null,
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

            const confirmedIds = new Set(msgs.map(idOf));

            const tempMessages = prev.filter(
                (m) => isTempId(idOf(m)) && !confirmedIds.has(idOf(m))
            );

            const base = appendToTop
                ? [...msgs, ...prev.filter((m) => !isTempId(idOf(m)))]
                : [...prev.filter((m) => !isTempId(idOf(m))), ...msgs];

            const combined = [...base, ...tempMessages];

            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: Array.from(
                        new Map(combined.map((m) => [idOf(m), m])).values()
                    ),
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
    updateMessage: (updatedMessage) =>
        set((state) => {
            const convId = updatedMessage.conversationId;
            const messages = state.messagesByConversation[convId];
            if (!messages) return {};

            const updated = messages.map((m) =>
                m._id === updatedMessage._id ? updatedMessage : m
            );

            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [convId]: updated,
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
    updateDeletedMessage: (updatedMessage: UIMessage) =>
        set((state) => {
            const convId = updatedMessage.conversationId;
            const messages = state.messagesByConversation[convId];
            if (!messages) return {};

            const updated = messages.map((m) =>
                m._id === updatedMessage._id ? updatedMessage : m
            );

            const updatedConversations = state.conversations.map((conv) =>
                conv._id === convId
                    ? { ...conv, lastMessage: updated[updated.length - 1] }
                    : conv
            );

            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [convId]: updated,
                },
                conversations: updatedConversations,
            };
        }),

    updateMessageReactions: (conversationId, updated) =>
        set((state) => {
            const current = state.messagesByConversation[conversationId] || [];
            const mapped = current.map((m) =>
                idOf(m) === idOf(updated) ? ({ ...m, reactions: updated.reactions } as UIMessage) : m
            );
            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: mapped,
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
    receiveMessage: (message: UIMessage) =>
        set((state) => {
            const conversationId = message.conversationId;
            const existing = state.messagesByConversation[conversationId] || [];

            if (existing.some((m) => idOf(m) === idOf(message))) {
                return {};
            }

            const updatedMessages = [...existing, message];

            const isOpen = state.selectedConversationId === conversationId;
            console.log("message", message);
            if (!message.sender || !message.sender._id) {
                console.error("Invalid message shape in store:", message);
                return {};
            }
            const senderId = message.sender._id;
            const isOwn = senderId === state.currentUserId;

            const conversations = state.conversations.map((conv) =>
                conv._id === conversationId
                    ? {
                        ...conv,
                        lastMessage: message,
                        unreadCount:
                            !isOpen && !isOwn
                                ? (conv.unreadCount || 0) + 1
                                : conv.unreadCount || 0,
                    }
                    : conv
            );

            const target = conversations.find((c) => c._id === conversationId);

            return {
                messagesByConversation: {
                    ...state.messagesByConversation,
                    [conversationId]: updatedMessages,
                },
                conversations: target
                    ? [target, ...conversations.filter((c) => c._id !== conversationId)]
                    : conversations,
            };
        }),
    repliedTo: {},
}));

export default useChatStore;