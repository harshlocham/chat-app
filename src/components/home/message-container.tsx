'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import useChatStore from "@/store/chat-store";
import { socket } from "@/lib/socket/socketClient";
//import { IMessagePopulated } from "@/models/Message";
import ChatBubble from "./chat-bubble";
import ChatDaySeparator from "./ChatDaySeparator";
import { useUser } from "@/context/UserContext";
import { ITempMessage } from "@/models/TempMessage";
import { deleteMessage } from "@/lib/utils/api";
import useSocketStore from "@/store/useSocketStore";
import { MessageEditPayload, MessageNewPayload } from "@/server/socket/types/SocketEvents";
import { markDelivered } from "@/lib/services/delivery.service";
import { ClientMessage } from "@/types/client-message";


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
    const { connect, joinConversation, leaveConversation } = useSocketStore();

    const fetchMessages = useCallback(async (cursor?: string) => {
        if (!sel) return;
        try {
            const res = await fetch(
                `/api/messages?conversationId=${sel}&cursor=${cursor || ""}`
            );
            const data = await res.json() as ClientMessage[];
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
        connect();
    }, [connect]);
    // SOCKET EVENTS

    useEffect(() => {
        joinConversation(conversationId);

        return () => {
            leaveConversation(conversationId);
        };
    }, [conversationId, joinConversation, leaveConversation]);


    useEffect(() => {
        if (!sel) return;

        // JOIN

        const handleNewMessage = (data: MessageNewPayload) => {
            console.log('handleNewMessage', data);
            const currentUserId = user?._id?.toString();

            if (!currentUserId) return;

            updateLastMessage(
                String(sel),
                data as unknown as ClientMessage
            );

            addMessage(
                String(sel),
                data
            );
            // Only receivers mark delivered
            if (data.sender !== currentUserId) {
                markDelivered(data._id, Date.now());
            }
        };
        const handleEditMessage = (data: MessageEditPayload) => {
            updateEditedMessage(data.conversationId, data.messageId, data.text);
            useChatStore
                .getState()
                .updateEditedMessage(conversationId, data.messageId, data.text);
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

        socket.on("message:new", handleNewMessage);
        socket.on("message:edited", handleEditMessage);
        socket.on("typing:start", handleTyping);
        socket.on("typing:stop", handleStopTyping);

        socket.on("message:delete", ({ messageId }) => {
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
            socket.emit("conversation:leave", { conversationId: String(sel) });
            socket.off("message:new", handleNewMessage);
            socket.off("message:edit", handleEditMessage);
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
        <div className="relative p-3 flex-1 overflow-auto h-full bg-chat-tile-light dark:bg-chat-tile-dark">
            <div className="mx-12 flex flex-col gap-3 h-full">
                <div ref={topRef} />
                {user && (messagesByConversation[conversationId] ?? []).map((msg) => {
                    const msgDate = new Date(msg.createdAt);
                    const dayKey = msgDate.toDateString();
                    const showSeparator = lastDate !== dayKey;
                    lastDate = dayKey;
                    console.log(msg)
                    return (
                        <div key={String(msg._id)}>
                            {showSeparator && <ChatDaySeparator date={msgDate} />}
                            <ChatBubble
                                message={msg as ITempMessage | ClientMessage}
                                currentUserId={user?._id?.toString()}
                                onDelete={deleteMessage}
                                onReply={() => { }}
                                onReact={(id, emoji) => socket.emit('message:reaction', { userId: user?._id?.toString(), messageId: String(id), emoji })} // 👈 socket.emit
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