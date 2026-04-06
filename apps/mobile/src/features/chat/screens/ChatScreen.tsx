import { StackScreenProps } from "@react-navigation/stack";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ChatsStackParamList } from "@/app/navigation/types";
import ChatBubble from "@/features/chat/components/ChatBubble";
import MessageInput from "@/features/chat/components/MessageInput";
import { useAuthStore } from "@/features/auth/store/authStore";
import type { ChatMessage } from "@/features/chat/store/chatStore";
import { chatSelectors, useChatStore } from "@/features/chat/store/chatStore";
import { useMessages } from "@/features/chat/hooks/useMessages";

const EMPTY_MESSAGES: ChatMessage[] = [];
type ChatScreenProps = StackScreenProps<ChatsStackParamList, "ChatRoom">;

const getUserId = (user: unknown): string | null => {
    if (!user || typeof user !== "object") {
        return null;
    }

    const value = user as { id?: unknown; _id?: unknown };

    if (typeof value.id === "string") {
        return value.id;
    }

    if (typeof value._id === "string") {
        return value._id;
    }

    return null;
};

export default function ChatScreen({ route }: ChatScreenProps) {
    const conversationId = route.params.conversationId;
    const selectedConversationId = useChatStore(chatSelectors.selectedConversationId);
    const setSelectedConversationId = useChatStore((state) => state.setSelectedConversationId);
    const conversation = useChatStore((state) =>
        selectedConversationId
            ? state.conversations.find((item) => item._id === selectedConversationId) ?? null
            : null
    );
    const storeMessages = useChatStore((state) =>
        conversationId ? state.messagesByConversation[conversationId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES
    );
    const setMessages = useChatStore((state) => state.setMessages);
    const clearMessages = useChatStore((state) => state.clearMessages);
    const setHasMore = useChatStore((state) => state.setHasMore);
    const clearUnread = useChatStore((state) => state.clearUnread);
    const user = useAuthStore((state) => state.user);
    const currentUserId = getUserId(user);

    useEffect(() => {
        if (conversationId) {
            setSelectedConversationId(conversationId);
        }
    }, [conversationId, setSelectedConversationId]);

    const title = useMemo(() => {
        return conversation?.name ?? conversation?.groupName ?? "Chat";
    }, [conversation?.groupName, conversation?.name]);

    const {
        data,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useMessages(conversationId);

    const queryMessages = useMemo(
        () => data?.pages.flatMap((page) => page.messages) ?? EMPTY_MESSAGES,
        [data?.pages]
    );

    useEffect(() => {
        if (!conversationId || !queryMessages) {
            return;
        }

        setMessages(conversationId, queryMessages, "replace");
        clearUnread(conversationId);
        setHasMore(conversationId, Boolean(hasNextPage));
    }, [clearUnread, conversationId, hasNextPage, queryMessages, setHasMore, setMessages]);

    useEffect(() => {
        if (!conversationId) {
            return;
        }

        return () => {
            clearMessages(conversationId);
        };
    }, [clearMessages, conversationId]);

    if (!conversationId) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center px-6 bg-white dark:bg-slate-950">
                <Text className="text-center text-slate-500 dark:text-slate-400">
                    Select a conversation to start chatting.
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-950">
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <Text className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</Text>
                    <Text className="text-sm text-slate-500 dark:text-slate-400">{conversation?._id ?? conversationId}</Text>
                </View>

                {isLoading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator />
                    </View>
                ) : (
                    <FlatList
                        inverted
                        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
                        data={storeMessages}
                        keyExtractor={(item) => item._id}
                        renderItem={({ item }) => (
                            <ChatBubble
                                message={item}
                                isMine={Boolean(currentUserId && item.sender._id === currentUserId)}
                            />
                        )}
                        onEndReachedThreshold={0.2}
                        onEndReached={() => {
                            if (hasNextPage && !isFetchingNextPage) {
                                void fetchNextPage();
                            }
                        }}
                        ListFooterComponent={
                            isFetchingNextPage ? (
                                <View className="items-center py-3">
                                    <ActivityIndicator />
                                </View>
                            ) : null
                        }
                        ListEmptyComponent={
                            <View className="flex-1 items-center justify-center px-6 py-10">
                                <Text className="text-sm text-slate-500 dark:text-slate-400">No messages yet.</Text>
                            </View>
                        }
                    />
                )}

                <MessageInput conversationId={conversationId} />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}