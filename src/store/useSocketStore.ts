// src/store/useSocketStore.ts
"use client";

import { create } from "zustand";
import { getSocket } from "@/lib/socket/socketClient";
import { SocketEvents } from "@/server/socket/types/SocketEvents";
import useChatStore from "./chat-store";

interface SocketState {
    connected: boolean;
    currentConversationId: string | null;
    onlineUsers: string[];
    typingUsers: Record<string, string[]>; // conversationId -> userIds[]

    connect: () => void;
    disconnect: () => void;
    joinConversation: (conversationId: string) => void;
    leaveConversation: (conversationId: string) => void;

    startTyping: (conversationId: string, userId: string) => void;
    stopTyping: (conversationId: string, userId: string) => void;

    sendMessage: (payload: any) => void;
}

const useSocketStore = create<SocketState>((set, get) => ({
    connected: false,
    currentConversationId: null,
    onlineUsers: [],
    typingUsers: {},

    connect: () => {
        const socket = getSocket();
        if (!socket.connected) socket.connect();
    },

    disconnect: () => {
        const socket = getSocket();
        if (socket.connected) socket.disconnect();
    },

    joinConversation: (conversationId: string) => {
        const socket = getSocket();
        const prev = get().currentConversationId;

        if (prev && prev !== conversationId) {
            socket.emit(SocketEvents.CONVERSATION_LEAVE, { conversationId: prev });
        }

        socket.emit(SocketEvents.CONVERSATION_JOIN, { conversationId });
        set({ currentConversationId: conversationId });
    },

    leaveConversation: (conversationId) => {
        const socket = getSocket();
        socket.emit(SocketEvents.CONVERSATION_LEAVE, { conversationId });
        set({ currentConversationId: null });
    },

    startTyping: (conversationId, userId) => {
        const socket = getSocket();
        socket.emit(SocketEvents.TYPING_START, { conversationId, userId });
    },

    stopTyping: (conversationId, userId) => {
        const socket = getSocket();
        socket.emit(SocketEvents.TYPING_STOP, { conversationId, userId });
    },

    sendMessage: (payload) => {
        const socket = getSocket();
        socket.emit(SocketEvents.MESSAGE_SEND, payload);

        // Optimistic UI insert
        if (payload.tempId) {
            useChatStore.getState().addOptimisticMessage(payload.conversationId, {
                _id: payload.tempId,
                senderId: payload.senderId,
                conversationId: payload.conversationId,
                isDeleted: false,
                content: payload.content,
                messageType: payload.type,
                createdAt: new Date().toISOString(),
                status: "pending",
                sender: payload.sender,
                timestamp: new Date().toISOString(),
            });
        }
    },
}));

export default useSocketStore;