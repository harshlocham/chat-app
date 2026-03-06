'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import useChatStore from "@/store/chat-store";
import { socket } from "@/lib/socket/socketClient";
import ChatBubble from "./chat-bubble";
import ChatDaySeparator from "./ChatDaySeparator";
import { useUser } from "@/context/UserContext";
import { deleteMessage, reactToMessage } from "@/lib/utils/api";
import useSocketStore from "@/store/useSocketStore";
import { MessageEditPayload } from "@/shared/types/SocketEvents";
import { UIMessage } from "@/shared/types/ui-message";


interface MessageContainerProps {
    conversationId: string;
}

const MessageContainer = ({ conversationId }: MessageContainerProps) => {
    const sel = useChatStore(s => s.selectedConversationId);
    let lastDate: string | null = null;
    const { messagesByConversation, addMessage, setMessages, setHasMore, updateEditedMessage, updateLastMessage } = useChatStore();
    const topRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const { user } = useUser();
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const { joinConversation, leaveConversation } = useSocketStore();

    const fetchMessages = useCallback(async (cursor?: string) => {
        if (!sel) return;
        try {
            const res = await fetch(
                `/api/messages?conversationId=${sel}&cursor=${cursor || ""}`
            );
            const data = await res.json() as UIMessage[];
            const redata = data.reverse();
            if (redata.length < 20) setHasMore(String(sel), false);
            setMessages(String(sel), redata, !!cursor);
        } catch (err) {
            console.error("Failed to load messages", err);
        }
    }, [sel, setMessages, setHasMore]);

    useEffect(() => {
        if (messagesByConversation[conversationId]?.length > 0 && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "auto" });
        }
    }, [conversationId, messagesByConversation]);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [conversationId, messagesByConversation]);

    useEffect(() => {
        fetchMessages();
    }, [sel, fetchMessages]);

    useEffect(() => {
        joinConversation(conversationId);

        return () => {
            leaveConversation(conversationId);
        };
    }, [conversationId, joinConversation, leaveConversation]);
    const handleReact = async (message: UIMessage, emoji: string) => {
        await reactToMessage(message, emoji);
    }

    useEffect(() => {
        if (!sel) return;

        // JOIN

        const handleEditMessage = (data: MessageEditPayload) => {
            updateEditedMessage(data.conversationId, data.messageId, data.text);
        }

        const handleTyping = ({ userId }: { userId: string }) => {
            setTypingUsers(prev => {
                if (!prev.includes(userId)) return [...prev, userId];
                return prev;
            });
        };

        const handleStopTyping = ({ userId }: { userId: string }) => {
            setTypingUsers(prev => prev.filter(u => u !== userId));
        };

        socket.on("message:edited", handleEditMessage);
        socket.on("typing:start", handleTyping);
        socket.on("typing:stop", handleStopTyping);



        return () => {
            socket.emit("conversation:leave", { conversationId: String(sel) });
            socket.off("message:edited", handleEditMessage);
            socket.off("typing:start", handleTyping);
            socket.off("typing:stop", handleStopTyping);
        };
    }, [user?._id, updateLastMessage, updateEditedMessage, sel, addMessage, conversationId]);


    const typingText =
        typingUsers.length === 0
            ? ""
            : typingUsers.length === 1
                ? `${typingUsers[0]} is typing`
                : `${typingUsers.join(", ")} are typing`;

    return (
        <div className="relative flex-1 overflow-auto h-full bg-chat-tile-light dark:bg-chat-tile-dark">
            <div className="mx-auto flex flex-col gap-3 h-full w-full max-w-3xl px-2 sm:px-6 py-4">
                <div ref={topRef} />
                {user && (messagesByConversation[conversationId] ?? []).map((msg) => {
                    const msgDate = new Date(msg.createdAt);
                    const dayKey = msgDate.toDateString();
                    const showSeparator = lastDate !== dayKey;
                    lastDate = dayKey;
                    return (
                        <div key={String(msg._id)}>
                            {showSeparator && <ChatDaySeparator date={msgDate} />}
                            <ChatBubble
                                message={msg}
                                currentUserId={user?._id}
                                onDelete={deleteMessage}
                                onReply={() => { }}
                                onReact={handleReact}
                            />
                        </div>
                    );
                })}

                {/* ✅ Typing indicator */}
                {typingUsers.length > 0 && (
                    <div className="bg-amber-600 flex items-center gap-2 ml-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>{typingText}</span>
                        <div className="flex space-x-1 animate-bounce">
                            <span className="dot"></span>
                            <span className="dot"></span>
                            <span className="dot"></span>
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default MessageContainer;