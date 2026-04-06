import { useCallback, useEffect, useRef } from "react";

import { normalizeConversation } from "@/features/chat/api/chatApi";
import { useChatStore, chatStoreUtils, type ChatMessageInput } from "@/features/chat/store/chatStore";
import { useSocket } from "@/providers/socket-provider";
import { ChatSocketEvents } from "./chatSocket";

export default function ChatSocketBridge() {
    const { connected, emit, on, off } = useSocket();
    const selectedConversationId = useChatStore((state) => state.selectedConversationId);
    const previousConversationIdRef = useRef<string | null>(null);

    const handleConnect = useCallback(() => {
        const activeConversationId = useChatStore.getState().selectedConversationId;

        if (!activeConversationId) {
            return;
        }

        emit(ChatSocketEvents.CONVERSATION_JOIN, {
            conversationId: activeConversationId,
        });
    }, [emit]);

    const handleMessageNew = useCallback((message: unknown) => {
        const normalized = chatStoreUtils.normalizeChatMessage(message as ChatMessageInput);
        const currentUserId = useChatStore.getState().currentUserId;

        useChatStore.getState().receiveMessage({
            ...normalized,
            status:
                normalized.sender._id === currentUserId
                    ? "delivered"
                    : normalized.status,
            delivered:
                normalized.sender._id === currentUserId
                    ? true
                    : normalized.delivered,
        });
    }, []);

    const handleMessageSeen = useCallback((payload: unknown) => {
        const value = payload as { messageId?: unknown; userId?: unknown };
        const messageId = chatStoreUtils.toStringId(value.messageId);
        const userId = chatStoreUtils.toStringId(value.userId);

        if (!messageId || !userId) {
            return;
        }

        useChatStore.getState().markMessageSeen(messageId, userId);
    }, []);

    const handleSyncMessages = useCallback((payload: unknown) => {
        const value = payload as { conversationId?: unknown; messages?: unknown[]; appendToTop?: boolean };
        const conversationId = chatStoreUtils.toStringId(value.conversationId);

        if (!conversationId) {
            return;
        }

        const messages = Array.isArray(value.messages)
            ? value.messages.map((item) => chatStoreUtils.normalizeChatMessage(item as ChatMessageInput))
            : [];

        useChatStore
            .getState()
            .setMessages(conversationId, messages, value.appendToTop ? "prepend" : "replace");
    }, []);

    const handleSyncConversations = useCallback((payload: unknown) => {
        const conversations = Array.isArray(payload) ? payload : [];

        useChatStore
            .getState()
            .setConversations(conversations.map((conversation) => normalizeConversation(conversation)));
    }, []);

    const handleConversationUpdated = useCallback((payload: unknown) => {
        useChatStore.getState().upsertConversation(normalizeConversation(payload));
    }, []);

    useEffect(() => {
        on("connect", handleConnect);
        on(ChatSocketEvents.MESSAGE_NEW, handleMessageNew);
        on(ChatSocketEvents.MESSAGE_SEEN, handleMessageSeen);
        on(ChatSocketEvents.SYNC_MESSAGES, handleSyncMessages);
        on(ChatSocketEvents.SYNC_CONVERSATIONS, handleSyncConversations);
        on(ChatSocketEvents.CONVERSATION_UPDATED, handleConversationUpdated);

        return () => {
            off("connect", handleConnect);
            off(ChatSocketEvents.MESSAGE_NEW, handleMessageNew);
            off(ChatSocketEvents.MESSAGE_SEEN, handleMessageSeen);
            off(ChatSocketEvents.SYNC_MESSAGES, handleSyncMessages);
            off(ChatSocketEvents.SYNC_CONVERSATIONS, handleSyncConversations);
            off(ChatSocketEvents.CONVERSATION_UPDATED, handleConversationUpdated);
        };
    }, [handleConnect, handleConversationUpdated, handleMessageNew, handleMessageSeen, handleSyncConversations, handleSyncMessages, off, on]);

    useEffect(() => {
        if (!connected) {
            return;
        }

        const previousConversationId = previousConversationIdRef.current;

        if (previousConversationId && previousConversationId !== selectedConversationId) {
            emit(ChatSocketEvents.CONVERSATION_LEAVE, { conversationId: previousConversationId });
        }

        if (selectedConversationId) {
            emit(ChatSocketEvents.CONVERSATION_JOIN, { conversationId: selectedConversationId });
        }

        previousConversationIdRef.current = selectedConversationId;
    }, [connected, emit, selectedConversationId]);

    useEffect(() => {
        return () => {
            const previousConversationId = previousConversationIdRef.current;

            if (connected && previousConversationId) {
                emit(ChatSocketEvents.CONVERSATION_LEAVE, { conversationId: previousConversationId });
            }
        };
    }, [connected, emit]);

    return null;
}