'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversationStore } from "@/store/chat-store";
import { socket } from "@/lib/socketClient";
import { IMessagePopulated } from "@/models/Message";
import ChatBubble from "./chat-bubble";
import ChatDaySeparator from "./ChatDaySeparator";
import { useUser } from "@/context/UserContext";


// interface ChatBubbleProps {
//     message: IMessagePopulated;
//     currentUserId: string;
// }

const MessageContainer = () => {
    const sel = useConversationStore(s => s.selectedConversation);
    let lastDate: string | null = null;
    const {
        messages,
        addMessage,
        setMessages,
        setHasMore,
    } = useConversationStore();

    const topRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const { user } = useUser();
    const [typingUsers, setTypingUsers] = useState<string[]>([]);




    //  Fetch paginated messages
    const fetchMessages = useCallback(async (cursor?: string) => {
        if (!sel?._id) return;
        try {
            const res = await fetch(
                `/api/messages?conversationId=${sel?._id}&cursor=${cursor || ""}`
            );
            const data = await res.json() as IMessagePopulated[];
            const redata = data.reverse();
            if (redata.length < 20) setHasMore(false);
            setMessages(redata, !!cursor); // prepend if paginating
        } catch (err) {
            console.error("Failed to load messages", err);
        }
    },
        [sel?._id, setMessages, setHasMore]);

    //  Scroll to bottom on first load
    useEffect(() => {
        if (messages.length > 0 && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "auto" });
        }
    }, [messages.length]);

    //  Infinite scroll up
    // const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    //     const scrollTop = e.currentTarget.scrollTop;
    //     if (scrollTop < 50 && hasMore && messages.length > 0) {
    //         const firstId = messages[0]._id.toString();
    //         await fetchMessages(firstId);
    //     }
    // };
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages.length]);


    //  Initial load
    useEffect(() => {
        fetchMessages();
    }, [sel?._id, fetchMessages]);

    //  Socket join and message listener




    useEffect(() => {
        if (!sel?._id) return;
        socket.emit('join', sel._id);
        const handleNewMessage = (msg: IMessagePopulated) => {
            addMessage(msg); // ✅ Consistent reference
        };
        const handleTyping = ({ userId }: { userId: string }) => {
            setTypingUsers(prev => {
                if (!prev.includes(userId)) return [...prev, userId];
                return prev;
            });
        };
        const handleStopTyping = ({ userId }: { userId: string }) => {
            setTypingUsers(prev => prev.filter(id => id !== userId));
        };
        socket.on('message:new', handleNewMessage);
        socket.on('typing', handleTyping);
        socket.on('stopTyping', handleStopTyping);

        return () => {
            socket.emit('leave', sel._id);
            socket.off('message:new', handleNewMessage);
            socket.off('typing', handleTyping);
            socket.off('stopTyping', handleStopTyping);
        };
    }, [sel?._id, addMessage]);

    // Typing indicator
    useEffect(() => {
        updateTypingUI(typingUsers);
    }, [typingUsers]);

    function updateTypingUI(usersTyping: string[]) {
        const indicator = document.getElementById("typing-indicator");
        if (!indicator) return;
        if (usersTyping.length === 0) {
            indicator.textContent = "";
        } else if (usersTyping.length === 1) {
            indicator.textContent = `${usersTyping[0]} is typing...`;
            //console.log(usersTyping[0]);
        } else {
            indicator.textContent = `${usersTyping.join(", ")} are typing...`;
        }
    }

    return (
        <div
            className='relative p-3 flex-1 overflow-auto h-full bg-chat-tile-light dark:bg-chat-tile-dark'
        // onScroll={handleScroll}
        >
            <div className='mx-12 flex flex-col gap-3 h-full'>
                <div ref={topRef} />
                {user && messages.map((msg) => {
                    const msgDate = new Date(msg.timestamp);
                    const dayKey = msgDate.toDateString();

                    const showSeparator = lastDate !== dayKey;
                    lastDate = dayKey;

                    return (
                        <div key={String(msg._id)} className="">
                            {showSeparator && <ChatDaySeparator date={msgDate} />}
                            <ChatBubble
                                key={String(msg._id)}
                                message={msg}
                                currentUserId={user?._id?.toString()}
                            />
                            <div id="typing-indicator" className="absolute bottom-0 right-0 text-xs text-gray-400 dark:text-gray-500"></div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default MessageContainer;