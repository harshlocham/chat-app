// e.g. src/components/home/typing-indicator.tsx
"use client";

import useSocketStore from "@/store/useSocketStore";
import { useUser } from "@/context/UserContext";

interface TypingIndicatorProps {
    conversationId: string;
}

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
