import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchConversationMessages } from "@/features/chat/api/chatApi";
import { chatSelectors, useChatStore } from "@/features/chat/store/chatStore";

const EMPTY_MESSAGES = [] as const;

export default function ChatScreen() {
    const selectedConversationId = useChatStore(chatSelectors.selectedConversationId);
    const conversation = useChatStore((state) =>
        selectedConversationId
            ? state.conversations.find((item) => item._id === selectedConversationId) ?? null
            : null
    );
    const messages = useChatStore((state) =>
        selectedConversationId
            ? state.messagesByConversation[selectedConversationId] ?? EMPTY_MESSAGES
            : EMPTY_MESSAGES
    );
    const setMessages = useChatStore((state) => state.setMessages);
    const clearMessages = useChatStore((state) => state.clearMessages);
    const setHasMore = useChatStore((state) => state.setHasMore);
    const clearUnread = useChatStore((state) => state.clearUnread);

    const [loading, setLoading] = useState(false);

    const title = useMemo(() => {
        return conversation?.name ?? conversation?.groupName ?? "Chat";
    }, [conversation?.groupName, conversation?.name]);

    useEffect(() => {
        if (!selectedConversationId) {
            return;
        }

        let isActive = true;

        (async () => {
            setLoading(true);

            try {
                const loadedMessages = await fetchConversationMessages(selectedConversationId);

                if (!isActive) {
                    return;
                }

                setMessages(selectedConversationId, loadedMessages, "replace");
                clearUnread(selectedConversationId);
                setHasMore(selectedConversationId, loadedMessages.length > 0);
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            isActive = false;
            clearMessages(selectedConversationId);
        };
    }, [clearMessages, clearUnread, selectedConversationId, setHasMore, setMessages]);

    if (!selectedConversationId) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center px-6 bg-white">
                <Text className="text-center text-slate-500">
                    Select a conversation to start chatting.
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="border-b border-slate-200 px-4 py-3">
                <Text className="text-lg font-semibold text-slate-900">{title}</Text>
                <Text className="text-sm text-slate-500">{conversation?._id ?? selectedConversationId}</Text>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator />
                </View>
            ) : (
                <FlatList
                    contentContainerStyle={{ padding: 16 }}
                    data={messages}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <View className="rounded-[18px] bg-slate-100 px-4 py-3 mb-3">
                            <Text className="text-xs font-medium text-slate-900 mb-1">
                                {item.sender.username || item.sender._id}
                            </Text>
                            <Text className="text-base text-slate-700">{item.content}</Text>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View className="items-center justify-center px-6 py-10">
                            <Text className="text-sm text-slate-500">No messages yet.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}