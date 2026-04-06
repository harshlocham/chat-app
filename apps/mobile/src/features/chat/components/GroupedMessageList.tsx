import { memo, useMemo } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import ChatBubble from "@/features/chat/components/ChatBubble";
import type { ChatMessage } from "@/features/chat/store/chatStore";
import { buildGroupedChatMessages } from "@/features/chat/utils/messageGrouping";

type GroupedMessageListProps = {
    messages: ChatMessage[];
    currentUserId: string | null;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    onFetchNextPage?: () => void;
    emptyLabel?: string;
};

function GroupedMessageList({
    messages,
    currentUserId,
    hasNextPage,
    isFetchingNextPage,
    onFetchNextPage,
    emptyLabel = "No messages yet.",
}: GroupedMessageListProps) {
    const groupedMessages = useMemo(
        () => buildGroupedChatMessages(messages, currentUserId),
        [currentUserId, messages]
    );

    return (
        <FlatList
            inverted
            contentContainerStyle={{ padding: 16, flexGrow: 1 }}
            data={groupedMessages}
            keyExtractor={(item) => item.message._id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={8}
            removeClippedSubviews
            renderItem={({ item }) => (
                <ChatBubble
                    message={item.message}
                    isMine={item.isMine}
                    showAvatar={item.showAvatar}
                    showSenderName={item.showSenderName}
                    showTimestamp={item.showTimestamp}
                    timestampLabel={item.timestampLabel}
                    compactSpacing={item.compactSpacing}
                />
            )}
            onEndReachedThreshold={0.2}
            onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                    onFetchNextPage?.();
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
                    <Text className="text-sm text-slate-500 dark:text-slate-400">{emptyLabel}</Text>
                </View>
            }
        />
    );
}

export default memo(GroupedMessageList);