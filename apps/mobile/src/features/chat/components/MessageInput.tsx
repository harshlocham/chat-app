import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthStore } from "@/features/auth/store/authStore";
import { useChatStore } from "@/features/chat/store/chatStore";
import { useSocket } from "@/providers/socket-provider";
import { ChatSocketEvents } from "@/features/chat/socket/chatSocket";

type MessageInputProps = {
    conversationId: string;
};

const SEND_TIMEOUT_MS = 12_000;

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

const getUsername = (user: unknown): string => {
    if (!user || typeof user !== "object") {
        return "You";
    }

    const value = user as { username?: unknown; name?: unknown; email?: unknown };

    if (typeof value.username === "string" && value.username.trim()) {
        return value.username;
    }

    if (typeof value.name === "string" && value.name.trim()) {
        return value.name;
    }

    if (typeof value.email === "string" && value.email.trim()) {
        return value.email;
    }

    return "You";
};

export default function MessageInput({ conversationId }: MessageInputProps) {
    const [text, setText] = useState("");
    const insets = useSafeAreaInsets();
    const conversations = useChatStore((state) => state.conversations);
    const upsertConversation = useChatStore((state) => state.upsertConversation);
    const addOptimisticMessage = useChatStore((state) => state.addOptimisticMessage);
    const updateMessageStatus = useChatStore((state) => state.updateMessageStatus);
    const replaceTempMessage = useChatStore((state) => state.replaceTempMessage);
    const removeMessage = useChatStore((state) => state.removeMessage);
    const user = useAuthStore((state) => state.user);
    const { emit, connected } = useSocket();

    const handleSend = () => {
        const content = text.trim();

        if (!content || !connected) {
            return;
        }

        const senderId = getUserId(user);

        if (!senderId) {
            return;
        }

        setText("");

        const createdAt = new Date().toISOString();
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        addOptimisticMessage(conversationId, {
            _id: tempId,
            conversationId,
            content,
            messageType: "text",
            sender: {
                _id: senderId,
                username: getUsername(user),
            },
            createdAt,
            updatedAt: createdAt,
            status: "pending",
            delivered: false,
            seen: false,
            isTemp: true,
        });

        const nextConversation = conversations.find((item) => item._id === conversationId);

        if (nextConversation) {
            upsertConversation({
                ...nextConversation,
                lastMessage: {
                    _id: tempId,
                    conversationId,
                    content,
                    messageType: "text",
                    sender: {
                        _id: senderId,
                        username: getUsername(user),
                    },
                    createdAt,
                    updatedAt: createdAt,
                    status: "pending",
                    delivered: false,
                    seen: false,
                    isTemp: true,
                },
                updatedAt: createdAt,
            });
        }

        const rollback = () => {
            removeMessage(conversationId, tempId);
        };

        const timeout = setTimeout(() => {
            rollback();
        }, SEND_TIMEOUT_MS);

        emit(
            ChatSocketEvents.MESSAGE_SEND,
            { conversationId, text: content },
            (ack?: { ok?: boolean; success?: boolean; error?: string; message?: unknown }) => {
                clearTimeout(timeout);

                if (ack && ack.ok === false) {
                    rollback();
                    return;
                }

                if (ack && ack.success === false) {
                    rollback();
                    return;
                }

                if (ack?.message && typeof ack.message === "object") {
                    replaceTempMessage(conversationId, tempId, {
                        ...(ack.message as any),
                        status: "sent",
                        delivered: false,
                        seen: false,
                    });
                    return;
                }

                updateMessageStatus(conversationId, tempId, "sent");
            }
        );
    };

    return (
        <View
            className="border-t border-slate-200 bg-white px-3 pt-3 dark:border-slate-800 dark:bg-slate-950"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
            <View className="flex-row items-end gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800">
                    <Ionicons name="add" size={18} color="#64748b" />
                </Pressable>
                <TextInput
                    className="min-h-[40px] flex-1 py-1 text-[15px] text-slate-900 dark:text-slate-100"
                    placeholder="Message"
                    placeholderTextColor="#94a3b8"
                    value={text}
                    onChangeText={setText}
                    multiline
                />
                <Pressable
                    className={`h-9 w-9 items-center justify-center rounded-full ${text.trim() ? "bg-emerald-600" : "bg-slate-200 dark:bg-slate-800"}`}
                    onPress={handleSend}
                    disabled={!text.trim() || !connected}
                >
                    <Ionicons
                        name="send"
                        size={16}
                        color={text.trim() ? "#ffffff" : "#64748b"}
                    />
                </Pressable>
            </View>
        </View>
    );
}
