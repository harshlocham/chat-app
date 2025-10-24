'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Laugh, Mic, Plus, Send, Image as ImageIcon } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { getMe } from "@/lib/api";
import { useConversationStore } from "@/store/chat-store";
import { socket } from "@/lib/socketClient";
import { IUser } from "@/models/User";
import { ImageUpload } from "./ImageUpload";
import toast from "react-hot-toast";
import { ITempMessage } from "@/models/TempMessage";
import { v4 as uuidv4 } from 'uuid';
import { useOfflineStore } from '@/store/offline-store';
import { useNetworkStatus } from '@/lib/hooks/useNetworkStatus';

// 🧠 Small debounce util
function debounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
    let timeout: NodeJS.Timeout;
    return (...args: T) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

const MessageInput = () => {
    const [msgText, setMsgText] = useState("");
    const [me, setMe] = useState<IUser | null>(null);
    const [showImageUpload, setShowImageUpload] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { addMessage, updateLastMessage, replaceTempMessage } = useConversationStore();
    const sel = useConversationStore((s) => s.selectedConversation);
    const isOnline = useNetworkStatus();
    const { addToQueue } = useOfflineStore();

    // ✅ Fetch logged-in user once
    useEffect(() => {
        const fetchMe = async () => {
            try {
                const response = await getMe();
                setMe(response);
            } catch (error) {
                console.error("Failed to fetch user data", error);
            }
        };
        fetchMe();
    }, []);

    // 📝 Handle typing indicators with debounce
    const handleTyping = useCallback(
        (conversationId: string) => {
            if (!me) return;
            socket.emit("typing", conversationId, me.username);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            typingTimeoutRef.current = setTimeout(() => {
                socket.emit("stopTyping", conversationId, me.username);
            }, 2000);
        },
        [me]
    );

    const debouncedTyping = useMemo(() => debounce(handleTyping, 300), [handleTyping]);

    // 📤 Send text message

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!msgText.trim() || !me || !sel?._id) return;

        const tempId = uuidv4();
        const tempMessage: ITempMessage = {
            _id: tempId,
            conversationId: String(sel._id),
            senderId: String(me._id),
            content: msgText.trim(),
            messageType: "text",
            createdAt: new Date().toISOString(),
            status: isOnline ? "pending" : "queued",
            sender: me,
            timestamp: new Date().toISOString(),
        };

        addMessage(tempMessage);
        updateLastMessage(tempMessage.conversationId, tempMessage);
        setMsgText("");
        if (!isOnline || socket.disconnected) {
            await addToQueue({ ...tempMessage, tempId: tempId });
            toast("Message queued. Will send when online.");
            return;
        }

        try {
            const res = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: tempMessage.content,
                    conversationId: sel._id,
                    senderId: me._id,
                }),
            });

            if (!res.ok) throw new Error("Failed to send message");
            const message = await res.json();

            replaceTempMessage(tempId, message);
            socket.emit("message:send", message);
        } catch (err) {
            console.error("Send message failed:", err);
            toast.error("Message failed to send");
        }
    };

    // 🖼️ Handle image upload
    const handleImageUpload = async (result: { url?: string; fileId?: string }) => {
        if (!result.url || !me || !sel) return;

        try {
            const res = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: result.url,
                    conversationId: sel._id,
                    senderId: me._id,
                    messageType: "image",
                }),
            });

            if (!res.ok) throw new Error("Failed to send image message");

            const message = await res.json();
            addMessage(message);
            socket.emit("message:send", message);
            toast.success("Image sent successfully!");
            setShowImageUpload(false);
        } catch (err) {
            console.error("Send image message failed:", err);
            toast.error("Failed to send image");
        }
    };

    return (
        <div className="relative bg-gray-primary p-2 flex gap-4 items-center">
            <div className="relative flex gap-2 ml-2">
                {/* Emoji Picker can be added here */}
                <Laugh className="text-gray-600 dark:text-gray-400" />
                <Plus className="text-gray-600 dark:text-gray-400" />
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowImageUpload(!showImageUpload)}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                    <ImageIcon size={20} />
                </Button>
            </div>

            <form className="w-full flex gap-3" onSubmit={handleSendMessage}>
                <div className="flex-1">
                    <Input
                        type="text"
                        placeholder="Type a message"
                        className="py-2 text-sm w-full rounded-lg shadow-sm bg-[hsl(var(--gray-tertiary))] focus-visible:ring-transparent"
                        value={msgText}
                        onChange={(e) => {
                            setMsgText(e.target.value);
                            if (sel?._id) debouncedTyping(String(sel._id));
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                            }
                        }}
                    />
                </div>

                <div className="mr-4 flex items-center gap-3">
                    {msgText.trim().length > 0 ? (
                        <Button
                            type="submit"
                            size="sm"
                            className="bg-transparent text-[hsl(var(--foreground))] hover:bg-transparent"
                        >
                            <Send />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            className="bg-transparent text-[hsl(var(--foreground))] hover:bg-transparent"
                        >
                            <Mic />
                        </Button>
                    )}
                </div>
            </form>

            {showImageUpload && (
                <div className="absolute bottom-full left-0 mb-2 w-64 p-4 border rounded-xl bg-background shadow-xl">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-medium">Send Image</h3>
                        <button
                            onClick={() => setShowImageUpload(false)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Close upload panel"
                        >
                            ✕
                        </button>
                    </div>
                    <ImageUpload
                        onSuccess={handleImageUpload}
                        onProgress={(progress) => {
                            if (progress === 100) toast.success("Image uploaded successfully!");
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default MessageInput;
