import { create } from "zustand";
import { IConversation } from "@/models/Conversation";
import { IMessage } from "@/models/Message";

interface ChatStore {
    selectedConversation: IConversation | null;
    messages: IMessage[];
    hasMore: boolean;
    onlineUsers: string[];
    setSelectedConversation: (conversation: IConversation | null) => void;
    setHasMore: (val: boolean) => void;
    setMessages: (msgs: IMessage[], appendToTop?: boolean) => void;
    addMessage: (msg: IMessage) => void;
    setOnlineUsers: (users: string[]) => void;
}

export const useConversationStore = create<ChatStore>((set, get) => ({
    selectedConversation: null,
    messages: [],
    hasMore: true,
    onlineUsers: [],

    setSelectedConversation: (conversation) =>
        set({ selectedConversation: conversation, messages: [] }),

    setHasMore: (val) => set({ hasMore: val }),

    setMessages: (msgs, appendToTop = false) =>
        set((state) => {
            const all = appendToTop
                ? [...msgs, ...state.messages]
                : [...state.messages, ...msgs];
            // Deduplicate:
            const unique = Array.from(
                new Map(all.map((m) => [m._id.toString(), m])).values()
            );
            return { messages: unique };
        }),

    addMessage: (msg) =>
        set((state) => {
            if (state.messages.some((m) => m._id.toString() === msg._id.toString())) {
                return {}; // already present, no update
            }
            return { messages: [...state.messages, msg] };
        }),

    setOnlineUsers: (users) => set({ onlineUsers: users }),
}));
