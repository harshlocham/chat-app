"use client";

import { useEffect } from "react";
import useSocketStore from "@/store/useSocketStore";

export function useConversationPresence(conversationId?: string | null) {
    const joinConversation = useSocketStore((s) => s.joinConversation);
    const leaveConversation = useSocketStore((s) => s.leaveConversation);

    useEffect(() => {
        if (!conversationId) return;

        joinConversation(conversationId);

        return () => {
            leaveConversation(conversationId);
        };
    }, [conversationId, joinConversation, leaveConversation]);
}
