// features/chat/hooks/useMessages.ts

import { useQuery } from "@tanstack/react-query";

import { fetchConversationMessages } from "../api/chatApi";

export const useMessages = (conversationId: string) => {
    return useQuery({
        queryKey: ["messages", conversationId],
        queryFn: () => fetchConversationMessages(conversationId),
        enabled: Boolean(conversationId),
    });
};