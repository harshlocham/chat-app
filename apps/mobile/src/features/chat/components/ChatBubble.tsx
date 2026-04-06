import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
    const status = message.status ?? (message.seen ? "seen" : message.delivered ? "delivered" : "sent");
    const showStatus = isMine;

    const statusIconName =
        status === "seen"
            ? "checkmark-done"
            : status === "delivered"
                ? "checkmark-done"
                : status === "pending" || status === "queued"
                    ? "time-outline"
                    : status === "failed"
                        ? "alert-circle-outline"
                    : "checkmark";

    const statusColor =
        status === "seen"
            ? "#60a5fa"
            : status === "delivered"
                ? "#cbd5e1"
                : status === "failed"
                    ? "#fca5a5"
                : "#cbd5e1";

    const statusLabel =
        status === "seen"
            ? "Seen"
            : status === "delivered"
                ? "Delivered"
                : status === "pending" || status === "queued"
                    ? "Sending"
                    : status === "failed"
                        ? "Failed"
                        : "Sent";

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

                {showStatus ? (
                    <View className="mt-2 flex-row items-center justify-end gap-1">
                        <Text className="text-[10px] text-white/75">
                            {statusLabel}
                        </Text>
                        <Ionicons name={statusIconName as any} size={12} color={statusColor} />
                    </View>
                ) : null}
            </View>

            <Text className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                {formatMessageTime(message.updatedAt || message.createdAt)}
            </Text>
        </View>
    );
}
