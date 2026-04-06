import { Pressable, Text, View } from "react-native";

import type { ChatConversation } from "@/features/chat/store/chatStore";

type ConversationListItemProps = {
    conversation: ChatConversation;
    currentUserId?: string | null;
    onPress: (conversationId: string) => void;
};

const previewByType: Record<string, string> = {
    image: "Photo",
    video: "Video",
    audio: "Audio",
    voice: "Voice message",
    file: "File",
    system: "System update",
};

function formatConversationTime(value?: string) {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

function getConversationName(conversation: ChatConversation, currentUserId?: string | null) {
    if (conversation.isGroup) {
        return conversation.groupName || conversation.name || "Group";
    }

    const other = conversation.participants.find((participant) => participant._id !== currentUserId);

    return other?.username || conversation.name || "Conversation";
}

function getPreviewText(conversation: ChatConversation, currentUserId?: string | null) {
    const last = conversation.lastMessage;

    if (!last) {
        return "Say hi to start this conversation";
    }

    const raw = previewByType[last.messageType] ?? last.content;
    const senderPrefix = last.sender._id === currentUserId ? "You: " : "";
    const combined = `${senderPrefix}${raw}`;

    return combined.length > 42 ? `${combined.slice(0, 42)}...` : combined;
}

export default function ConversationListItem({
    conversation,
    currentUserId,
    onPress,
}: ConversationListItemProps) {
    const conversationId = conversation._id;
    const title = getConversationName(conversation, currentUserId);
    const preview = getPreviewText(conversation, currentUserId);
    const timeLabel = formatConversationTime(conversation.updatedAt || conversation.createdAt);
    const initial = title.trim().charAt(0).toUpperCase() || "C";
    const unreadCount = conversation.unreadCount ?? 0;

    return (
        <Pressable
            className="flex-row items-center gap-3 px-4 py-3 active:opacity-80"
            onPress={() => onPress(conversationId)}
        >
            <View className="h-11 w-11 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
                <Text className="text-sm font-semibold text-slate-700 dark:text-slate-100">{initial}</Text>
            </View>

            <View className="flex-1 border-b border-slate-200 pb-3 dark:border-slate-800">
                <View className="mb-1 flex-row items-center justify-between gap-2">
                    <Text className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100" numberOfLines={1}>
                        {title}
                    </Text>
                    <Text className="text-xs text-slate-500 dark:text-slate-400">{timeLabel}</Text>
                </View>

                <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 text-xs text-slate-500 dark:text-slate-400" numberOfLines={1}>
                        {preview}
                    </Text>

                    {unreadCount > 0 ? (
                        <View className="rounded-full bg-emerald-600 px-2 py-0.5 dark:bg-emerald-500">
                            <Text className="text-[10px] font-semibold text-white">{unreadCount}</Text>
                        </View>
                    ) : null}
                </View>
            </View>
        </Pressable>
    );
}
