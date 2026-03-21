"use client";

import MessageContainer from "./message-container";

interface MessageListProps {
    conversationId: string;
}

export default function MessageList({ conversationId }: MessageListProps) {
    return <MessageContainer conversationId={conversationId} />;
}
