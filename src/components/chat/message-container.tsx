"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useChatStore from "@/store/chat-store";
import { socket } from "@/lib/socket/socketClient";
import ChatBubble from "./chat-bubble";
import ChatDaySeparator from "../home/ChatDaySeparator";
import { useUser } from "@/context/UserContext";
import { deleteMessage, reactToMessage } from "@/lib/utils/api";
import useSocketStore from "@/store/useSocketStore";
import { MessageEditPayload } from "@/shared/types/SocketEvents";
import { UIMessage } from "@/shared/types/ui-message";
import { AnimatePresence, motion } from "framer-motion";

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
    const [newMessages, setNewMessages] = useState(false);

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
    };

    useEffect(() => {
        if (!sel) return;

        // JOIN

        const handleEditMessage = (data: MessageEditPayload) => {
            updateEditedMessage(data.conversationId, data.messageId, data.text);
        };

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

    const scrollToBottom = () => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        setNewMessages(false);
    };

    // typingText is not used, so removed.

    // Group messages by sender and time
    function groupMessages(messages: UIMessage[]) {
        const groups: Array<{ messages: UIMessage[]; showAvatar: boolean; showUsername: boolean }> = [];
        let prev: UIMessage | null = null;
        // ...existing code...
        for (const msg of messages) {
            const msgDate = new Date(msg.createdAt);
            let showAvatar = true;
            let showUsername = true;
            if (
                prev &&
                prev.sender && msg.sender &&
                String(prev.sender._id || prev.sender) === String(msg.sender._id || msg.sender) &&
                Math.abs(new Date(prev.createdAt).getTime() - msgDate.getTime()) < 2 * 60 * 1000
            ) {
                showAvatar = false;
                showUsername = false;
                groups[groups.length - 1].messages.push(msg);
            } else {
                groups.push({ messages: [msg], showAvatar, showUsername });
            }
            prev = msg;
        }
        return groups;
    }

    const grouped = groupMessages(messagesByConversation[conversationId] ?? []);

    return (
        <div className="relative flex-1 overflow-auto h-full bg-[hsl(var(--container))] text-[hsl(var(--foreground))]">
            {/* Floating New Messages button */}
            {newMessages && (
                <button
                    className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-50 animate-fade-in"
                    onClick={scrollToBottom}
                >
                    New Messages
                </button>
            )}
            <div className="mx-auto flex flex-col gap-3 h-full w-full max-w-3xl px-2 sm:px-6 py-4">
                <div ref={topRef} />
                <AnimatePresence initial={false}>
                    {user && grouped.map((group) => (
                        <motion.div
                            key={String(group.messages[0]._id)}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 16 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                        >
                            {/* Day separator for first message in group */}
                            {(() => {
                                const msgDate = new Date(group.messages[0].createdAt);
                                const dayKey = msgDate.toDateString();
                                const showSeparator = lastDate !== dayKey;
                                lastDate = dayKey;
                                return showSeparator ? <ChatDaySeparator date={msgDate} /> : null;
                            })()}
                            {group.messages.map((msg, i) => (
                                <ChatBubble
                                    key={String(msg._id)}
                                    message={msg}
                                    currentUserId={user?._id}
                                    onDelete={deleteMessage}
                                    onReply={() => { }}
                                    onReact={handleReact}
                                    showAvatar={group.showAvatar && i === 0}
                                    showUsername={group.showUsername && i === 0}
                                />
                            ))}
                        </motion.div>
                    ))}
                </AnimatePresence>
                {/* ✅ Typing indicator */}
                {typingUsers.length > 0 && (
                    <div className="flex items-center gap-2 ml-4 mt-2 text-sm text-blue-400 dark:text-blue-300">
                        <span>
                            {typingUsers.length === 1
                                ? `${typingUsers[0]} is typing`
                                : `${typingUsers.join(", ")} are typing`}
                        </span>
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-typing-dot" />
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-typing-dot animation-delay-150" />
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-typing-dot animation-delay-300" />
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default MessageContainer;
