import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { sendChatMessage } from "@/features/chat/api/chatApi";
import { conversationMessagesQueryKey } from "@/features/chat/hooks/useMessages";
import { useChatStore } from "@/features/chat/store/chatStore";

type MessageInputProps = {
    conversationId: string;
};

export default function MessageInput({ conversationId }: MessageInputProps) {
    const [text, setText] = useState("");
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const conversations = useChatStore((state) => state.conversations);
    const upsertConversation = useChatStore((state) => state.upsertConversation);

    const sendMutation = useMutation({
        mutationFn: async () => {
            const content = text.trim();

            if (!content) {
                return null;
            }

            return sendChatMessage({
                conversationId,
                content,
                messageType: "text",
            });
        },
        onSuccess: (message) => {
            if (!message) {
                return;
            }

            queryClient.setQueryData(conversationMessagesQueryKey(conversationId), (current: any) => {
                if (!current?.pages?.length) {
                    return {
                        pageParams: [undefined],
                        pages: [
                            {
                                messages: [message],
                                nextCursor: undefined,
                            },
                        ],
                    };
                }

                const [firstPage, ...restPages] = current.pages;

                return {
                    ...current,
                    pages: [
                        {
                            ...firstPage,
                            messages: [message, ...firstPage.messages],
                        },
                        ...restPages,
                    ],
                };
            });

            const nextConversation = conversations.find((item) => item._id === conversationId);

            upsertConversation(
                nextConversation
                    ? {
                        ...nextConversation,
                        lastMessage: message,
                        updatedAt: message.createdAt,
                    }
                    : {
                        _id: conversationId,
                        type: "direct",
                        participants: [],
                        isGroup: false,
                        lastMessage: message,
                        updatedAt: message.createdAt,
                    }
            );

            setText("");
        },
    });

    const handleSend = () => {
        if (sendMutation.isPending || !text.trim()) {
            return;
        }

        sendMutation.mutate();
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
                    disabled={!text.trim() || sendMutation.isPending}
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
