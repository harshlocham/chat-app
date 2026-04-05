// features/chat/hooks/useMessages.ts

import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchConversationMessages } from '../api/chatApi';

export const useMessages = (conversationId: string) => {
    return useInfiniteQuery({
        queryKey: ['messages', conversationId],
        queryFn: ({ pageParam }: { pageParam: string }) =>
            fetchConversationMessages(conversationId, pageParam),
        getNextPageParam: (lastPage: { nextCursor: string }) => lastPage.nextCursor,
    });
};