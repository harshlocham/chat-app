'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversationStore } from "@/store/chat-store";
import { socket } from "@/lib/socketClient";
import { IMessagePopulated } from "@/models/Message";
import { IUser } from "@/models/User";
import ChatBubble from "./chat-bubble";
import { getMe } from "@/lib/api";
import ChatDaySeparator from "./ChatDaySeparator";

const MessageContainer = () => {
    const sel = useConversationStore(s => s.selectedConversation);
    let lastDate: string | null = null;
    const {
        messages,
        addMessage,
        setMessages,
        setHasMore,
    } = useConversationStore();

    const [loading, setLoading] = useState(false);
    const topRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const [me, setMe] = useState<IUser | null>(null);

    useEffect(() => {
        const fetchMe = async () => {
            try {
                const res = await getMe();
                setMe(res);
            } catch (err) {
                console.error("Failed to fetch user info", err);
            }
        };
        fetchMe();
    }, []);


    //  Fetch paginated messages
    const fetchMessages = useCallback(async (cursor?: string) => {
        if (!sel?._id || loading) return;
        setLoading(true);
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
        } finally {
            setLoading(false);
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
        socket.on('message:new', handleNewMessage);

        return () => {
            socket.emit('leave', sel._id);
            socket.off('message:new', handleNewMessage);
        };
    }, [sel?._id, addMessage]);

    return (
        <div
            className='relative p-3 flex-1 overflow-auto h-full bg-chat-tile-light dark:bg-chat-tile-dark'
        // onScroll={handleScroll}
        >
            <div className='mx-12 flex flex-col gap-3 h-full'>
                <div ref={topRef} />
                {messages.map((msg) => {
                    const msgDate = new Date(msg.timestamp);
                    const dayKey = msgDate.toDateString();

                    const showSeparator = lastDate !== dayKey;
                    lastDate = dayKey;

                    return (
                        <div key={String(msg._id)}>
                            {showSeparator && <ChatDaySeparator date={msgDate} />}
                            <ChatBubble
                                message={msg}
                                isSender={msg.sender._id === me?._id}
                            />
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default MessageContainer;