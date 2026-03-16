"use client";

import { useMemo } from "react";
import useChatStore from "@/store/chat-store";

interface TypingIndicatorProps {
    conversationId: string;
}

export default function TypingIndicator({ conversationId }: TypingIndicatorProps) {
    const { typingByConversation, conversations, currentUserId } = useChatStore();

    const typingText = useMemo(() => {
        const typingUserIds = typingByConversation[conversationId] || [];
        if (typingUserIds.length === 0) return null;

        const conversation = conversations.find(
            (item) => String(item._id) === conversationId
        );
        if (!conversation) return null;

        const names = typingUserIds
            .filter((userId) => userId && userId !== currentUserId)
            .map((userId) => {
                const participant = conversation.participants.find(
                    (user) => String(user._id) === userId
                );
                return participant?.username || "Someone";
            });

        const uniqueNames = Array.from(new Set(names));
        if (uniqueNames.length === 0) return null;

        if (uniqueNames.length === 1) {
            return `${uniqueNames[0]} is typing`;
        }

        return `${uniqueNames.join(", ")} are typing`;
    }, [typingByConversation, conversationId, conversations, currentUserId]);

    if (!typingText) return null;

    return (
        <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
            <div className="flex items-center gap-2 text-sm text-blue-400 dark:text-blue-300">
                <span>{typingText}</span>
                <div className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-400 animate-typing-dot" />
                    <span className="h-2 w-2 rounded-full bg-blue-400 animate-typing-dot animation-delay-150" />
                    <span className="h-2 w-2 rounded-full bg-blue-400 animate-typing-dot animation-delay-300" />
                </div>
            </div>
        </div>
    );
}
