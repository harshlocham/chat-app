import { StackScreenProps } from "@react-navigation/stack";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ChatsStackParamList } from "@/app/navigation/types";
import PresenceDot from "@/components/common/PresenceDot";
import ChatBubble from "@/features/chat/components/ChatBubble";
import MessageInput from "@/features/chat/components/MessageInput";
import TypingIndicator from "@/features/chat/components/TypingIndicator";
import { useAuthStore } from "@/features/auth/store/authStore";
import type { ChatMessage } from "@/features/chat/store/chatStore";
import { chatSelectors, useChatStore } from "@/features/chat/store/chatStore";
import { useMessages } from "@/features/chat/hooks/useMessages";
import { usePresenceStore } from "@/store/presence-store";

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

function formatLastSeen(value?: string | null) {
    if (!value) {
        return "Offline";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Offline";
    }

    const diffMinutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));

    if (diffMinutes < 60) {
        return `last seen ${diffMinutes} min ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours < 24) {
        return `last seen ${diffHours} hr ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `last seen ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export default function ChatScreen({ route }: ChatScreenProps) {
    const conversationId = route.params.conversationId;
    const selectedConversationId = useChatStore(chatSelectors.selectedConversationId);
    const setSelectedConversationId = useChatStore((state) => state.setSelectedConversationId);
    const conversation = useChatStore((state) =>
        selectedConversationId
            ? state.conversations.find((item) => item._id === selectedConversationId) ?? null
            : null
    );
    const onlineUsers = usePresenceStore((state) => state.onlineUsers);
    const lastSeenByUser = usePresenceStore((state) => state.lastSeenByUser);
    const storeMessages = useChatStore((state) =>
        conversationId ? state.messagesByConversation[conversationId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES
    );
    const typingUsers = useChatStore(chatSelectors.typingUsersByConversationId(conversationId));
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

    const presence = useMemo(() => {
        const participants = conversation?.participants.filter((participant) => participant._id !== currentUserId) ?? [];
        const activeParticipants = participants.filter((participant) => {
            return Boolean(onlineUsers[participant._id] || participant.isOnline);
        });

        if (participants.length === 0) {
            return { online: false, label: "Offline" };
        }

        if (!conversation?.isGroup) {
            const other = participants[0] ?? null;
            const lastSeen =
                other ? (lastSeenByUser[other._id] ?? other.lastSeen ?? null) : null;

            return {
                online: Boolean(other && (onlineUsers[other._id] || other.isOnline)),
                label: Boolean(other && (onlineUsers[other._id] || other.isOnline))
                    ? "Online"
                    : formatLastSeen(lastSeen),
            };
        }

        const latestLastSeen = participants.reduce<string | null>((latest, participant) => {
            const candidate = lastSeenByUser[participant._id] ?? participant.lastSeen ?? null;

            if (!candidate) {
                return latest;
            }

            if (!latest) {
                return candidate;
            }

            const candidateTime = new Date(candidate).getTime();
            const latestTime = new Date(latest).getTime();

            return Number.isNaN(candidateTime) || candidateTime <= latestTime ? latest : candidate;
        }, null);

        return {
            online: activeParticipants.length > 0,
            label:
                activeParticipants.length > 0
                    ? `${activeParticipants.length} online`
                    : formatLastSeen(latestLastSeen),
        };
    }, [conversation?.isGroup, conversation?.participants, currentUserId, lastSeenByUser, onlineUsers]);

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

    const messagesMatch = useMemo(() => {
        if (storeMessages.length !== queryMessages.length) {
            return false;
        }

        return storeMessages.every((message, index) => message._id === queryMessages[index]?._id);
    }, [queryMessages, storeMessages]);

    useEffect(() => {
        if (!conversationId || !queryMessages) {
            return;
        }

        if (!messagesMatch) {
            setMessages(conversationId, queryMessages, "replace");
        }

        clearUnread(conversationId);
        setHasMore(conversationId, Boolean(hasNextPage));
    }, [clearUnread, conversationId, hasNextPage, messagesMatch, queryMessages, setHasMore, setMessages]);

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
                    <View className="flex-row items-center gap-2">
                        <View className="relative h-9 w-9 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800">
                            <Text className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                                {title.trim().charAt(0).toUpperCase() || "C"}
                            </Text>
                            <View className="absolute -right-0.5 -top-0.5">
                                <PresenceDot online={presence.online} />
                            </View>
                        </View>

                        <View className="flex-1">
                            <Text className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</Text>
                            <Text className="text-sm text-slate-500 dark:text-slate-400">{presence.label}</Text>
                        </View>
                    </View>
                </View>

                {isLoading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator />
                    </View>
                ) : (
                    <View className="flex-1">
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

                        <TypingIndicator typingUsers={typingUsers} currentUserId={currentUserId} />
                    </View>
                )}

                <MessageInput conversationId={conversationId} />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}