// e.g. src/components/home/typing-indicator.tsx
"use client";

import useSocketStore from "@/store/useSocketStore";
import { useUser } from "@/context/UserContext";

interface TypingIndicatorProps {
    conversationId: string;
}

/**
 * Render a compact typing indicator for a conversation.
 *
 * @param conversationId - ID of the conversation whose typing users should be displayed
 * @returns A small div showing a comma-separated list of usernames (falls back to "Someone" for unknown users) followed by " typing…", or `null` if no users are typing
 */
export default function TypingIndicator({ conversationId }: TypingIndicatorProps) {
    const { typingUsers } = useSocketStore();
    const { usersById } = useUser(); // assume you have this

    const userIds = Array.from(typingUsers[conversationId] || []);

    if (!userIds.length) return null;

    const names = userIds
        .map((id) => usersById[id]?.username || "Someone")
        .join(", ");

    return (
        <div className="px-4 py-1 text-xs text-muted-foreground">
            {names} typing…
        </div>
    );
}