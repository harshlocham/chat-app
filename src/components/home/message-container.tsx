'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useConversationStore } from "@/store/chat-store";
import { socket } from "@/lib/socketClient";
import { IMessage } from "@/models/Message";
import ChatBubble from "./chat-bubble";
import { getMe } from "@/lib/api";

const MessageContainer = () => {
    const sel = useConversationStore(s => s.selectedConversation);

    const {
        messages,
        addMessage,
        setMessages,
        hasMore,
        setHasMore,
    } = useConversationStore();

    const [loading, setLoading] = useState(false);
    const topRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const [me, setMe] = useState<any>(null);

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
    const fetchMessages = async (cursor?: string) => {
        if (!sel?._id || loading) return;
        setLoading(true);
        try {
            const res = await fetch(
                `/api/messages?conversationId=${sel?._id}&cursor=${cursor || ""}`
            );
            const data = await res.json() as any[];
            const redata = data.reverse();
            if (redata.length < 20) setHasMore(false);
            setMessages(redata, !!cursor); // prepend if paginating
        } catch (err) {
            console.error("Failed to load messages", err);
        } finally {
            setLoading(false);
        }
    };

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
    }, [sel?._id]);

    //  Socket join and message listener

    // const handleNewMessage = useCallback((msg: IMessage) => {
    //     console.log('📨 Received message:new', msg);
    //     addMessage(msg);
    // }, [addMessage]);


    useEffect(() => {
        if (!sel?._id) return;
        socket.emit('join', sel._id);
        const handleNewMessage = (msg: IMessage) => {
            addMessage(msg); // ✅ Consistent reference
        };
        socket.on('message:new', handleNewMessage);

        return () => {
            socket.emit('leave', sel._id);
            socket.off('message:new', handleNewMessage);
        };
    },);

    return (
        <div
            className='relative p-3 flex-1 overflow-auto h-full bg-chat-tile-light dark:bg-chat-tile-dark'
        // onScroll={handleScroll}
        >
            <div className='mx-12 flex flex-col gap-3 h-full'>
                <div ref={topRef} />
                {messages.map((msg) => (
                    <div key={String(msg._id)}>
                        <ChatBubble
                            message={msg}
                            isSender={me?._id === msg.sender}
                        />
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default MessageContainer;