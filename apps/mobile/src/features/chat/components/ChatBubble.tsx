import { Text, View } from "react-native";

import type { ChatMessage } from "@/features/chat/store/chatStore";

type ChatBubbleProps = {
    message: ChatMessage;
    isMine: boolean;
};

function formatMessageTime(value?: string) {
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

export default function ChatBubble({ message, isMine }: ChatBubbleProps) {
    const senderName = message.sender.username || message.sender._id || "Unknown";

    return (
        <View className={`mb-3 ${isMine ? "items-end" : "items-start"}`}>
            <View
                className={`max-w-[82%] rounded-2xl px-4 py-3 ${isMine
                        ? "bg-emerald-600 dark:bg-emerald-500"
                        : "bg-slate-100 dark:bg-slate-800"
                    }`}
            >
                {!isMine ? (
                    <Text className="mb-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {senderName}
                    </Text>
                ) : null}

                <Text
                    className={`text-sm leading-5 ${isMine ? "text-white" : "text-slate-800 dark:text-slate-100"
                        }`}
                >
                    {message.content}
                </Text>
            </View>

            <Text className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                {formatMessageTime(message.updatedAt || message.createdAt)}
            </Text>
        </View>
    );
}
