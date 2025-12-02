'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import useChatStore from "@/store/chat-store";
import { socket } from "@/lib/socket/socketClient";
import { IMessage, IMessagePopulated } from "@/models/Message";
import ChatBubble from "./chat-bubble";
import ChatDaySeparator from "./ChatDaySeparator";
import { useUser } from "@/context/UserContext";
import { ITempMessage } from "@/models/TempMessage";
import { deleteMessage } from "@/lib/utils/api";
import useSocketStore from "@/store/useSocketStore";


interface MessageContainerProps {
    conversationId: string;
}

const MessageContainer = ({ conversationId }: MessageContainerProps) => {
    const sel = useChatStore(s => s.selectedConversation);
    let lastDate: string | null = null;
    const { messagesByConversation, addMessage, setMessages, setHasMore } = useChatStore();
    const topRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const { user } = useUser();
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const { connect, joinConversation, leaveConversation } = useSocketStore();

    // 🕒 Store timeout IDs for each typing user
    const typingTimeouts = useRef<{ [username: string]: NodeJS.Timeout }>({});

    const fetchMessages = useCallback(async (cursor?: string) => {
        if (!sel?._id) return;
        try {
            const res = await fetch(
                `/api/messages?conversationId=${sel?._id}&cursor=${cursor || ""}`
            );
            const data = await res.json() as IMessagePopulated[];
            const redata = data.reverse();
            if (redata.length < 20) setHasMore(String(sel?._id), false);
            setMessages(String(sel?._id), redata, !!cursor);
        } catch (err) {
            console.error("Failed to load messages", err);
        }
    }, [sel?._id, setMessages, setHasMore]);

    useEffect(() => {
        if (messagesByConversation[conversationId].length > 0 && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "auto" });
        }
    }, [messagesByConversation[conversationId].length]);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messagesByConversation[conversationId].length]);

    useEffect(() => {
        fetchMessages();
    }, [sel?._id, fetchMessages]);
    useEffect(() => {
        connect();
    }, [connect]);
    // SOCKET EVENTS

    useEffect(() => {
        joinConversation({ conversationId });

        return () => {
            leaveConversation({ conversationId });
        };
    }, [conversationId, joinConversation, leaveConversation]);


    useEffect(() => {
        if (!sel?._id) return;
        socket.emit('join', sel._id);

        const handleNewMessage = (msg: IMessagePopulated) => addMessage(String(sel?._id), msg);

        const handleTyping = ({ username }: { username: string }) => {
            // Add or refresh typing user
            setTypingUsers(prev => {
                if (!prev.includes(username)) return [...prev, username];
                return prev;
            });

            // Clear any existing timeout for this user
            if (typingTimeouts.current[username]) {
                clearTimeout(typingTimeouts.current[username]);
            }

            // 🕒 Remove after 4 seconds if no further typing
            typingTimeouts.current[username] = setTimeout(() => {
                setTypingUsers(prev => prev.filter(u => u !== username));
                delete typingTimeouts.current[username];
            }, 1000);
        };

        const handleStopTyping = ({ userId }: { userId: string }) => {
            setTypingUsers(prev => prev.filter(u => u !== userId));
            if (typingTimeouts.current[userId]) {
                clearTimeout(typingTimeouts.current[userId]);
                delete typingTimeouts.current[userId];
            }
        };

        socket.on('message:new', handleNewMessage);
        socket.on('typing', handleTyping);
        socket.on('stopTyping', handleStopTyping);
        socket.on("message:deleted", ({ messageId, conversationId }) => {
            useChatStore.setState((state) => {
                const msgs = state.messagesByConversation[conversationId] || [];

                return {
                    messagesByConversation: {
                        ...state.messagesByConversation,
                        [conversationId]: msgs.map((msg) =>
                            msg._id.toString() === messageId
                                ? { ...msg, isDeleted: true, text: "This message was deleted" }
                                : msg
                        ),
                    },
                };
            });
        });

        return () => {
            socket.emit('leave', sel._id);
            socket.off('message:new', handleNewMessage);
            socket.off('typing', handleTyping);
            socket.off('stopTyping', handleStopTyping);

            // Cleanup all timers
            Object.values(typingTimeouts.current).forEach(clearTimeout);
            typingTimeouts.current = {};
        };
    }, [sel?._id, addMessage]);

    const typingText =
        typingUsers.length === 0
            ? ""
            : typingUsers.length === 1
                ? `${typingUsers[0]} is typing`
                : `${typingUsers.join(", ")} are typing`;

    return (
        <div className="relative p-3 flex-1 overflow-auto h-full bg-chat-tile-light dark:bg-chat-tile-dark">
            <div className="mx-12 flex flex-col gap-3 h-full">
                <div ref={topRef} />
                {user && messagesByConversation[conversationId].map((msg) => {
                    const msgDate = new Date(msg.timestamp);
                    const dayKey = msgDate.toDateString();
                    const showSeparator = lastDate !== dayKey;
                    lastDate = dayKey;

                    return (
                        <div key={String(msg._id)}>
                            {showSeparator && <ChatDaySeparator date={msgDate} />}
                            <ChatBubble
                                message={msg as ITempMessage | IMessage}
                                currentUserId={user?._id?.toString()}
                                onEdit={(id: string, newText: string) => socket.emit('message:edit', { messageId: id, content: newText })}
                                onDelete={deleteMessage}
                                onReply={() => { }}
                                onReact={(id, emoji) => socket.emit('message:react', { messageId: id, emoji })}
                            />
                        </div>
                    );
                })}

                {/* ✅ Typing indicator */}
                {typingUsers.length > 0 && (
                    <div className="flex items-center gap-2 ml-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
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