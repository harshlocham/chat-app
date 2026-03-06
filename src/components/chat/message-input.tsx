'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Laugh, Mic, Plus, Send, Image as ImageIcon } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { getMe } from "@/lib/utils/api";
import useChatStore from "@/store/chat-store";
import { getSocket } from "@/lib/socket/socketClient";
import { ClientUser } from "@/shared/types/user";
import { ImageUpload } from "../home/ImageUpload";
import { toast } from "sonner"
import { v4 as uuidv4 } from 'uuid';
import { useOfflineStore } from '@/store/offline-store';
import { useNetworkStatus } from '@/lib/hooks/useNetworkStatus';
import { useRateLimitHandler } from "@/lib/hooks/useRateLimitHandler";
import useSocketStore from "@/store/useSocketStore";
import { UIMessage } from "@/shared/types/ui-message";

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
    const [me, setMe] = useState<ClientUser | null>(null);
    const [showImageUpload, setShowImageUpload] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const { selectedConversation, addMessage, updateLastMessage, replaceTempMessage, editingMessage, clearEditingMessage, updateEditedMessage, repliedTo } = useChatStore();
    const sel = useChatStore((s) => s.selectedConversationId);
    const isOnline = useNetworkStatus();
    const { addToQueue } = useOfflineStore();
    const { sendMessage } = useSocketStore();
    const socket = getSocket();
    //  Rate limit handler
    const { isRateLimited, timeLeft, triggerRateLimit } = useRateLimitHandler(5000);
    const conversationMembers =
        selectedConversation?.participants.map(m => m._id) ?? [];
    const activeReply = sel ? repliedTo[sel] : undefined;

    //  Fetch logged-in user once
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
    useEffect(() => {
        if (editingMessage) {
            setMsgText(editingMessage.content);
        }
    }, [editingMessage]);

    // 📝 Handle typing indicators with debounce
    const handleTyping = useCallback(
        (conversationId: string) => {
            if (!me) return;
            socket.emit("typing:start", { conversationId, userId: String(me._id) });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            typingTimeoutRef.current = setTimeout(() => {
                socket.emit("typing:stop", { conversationId: conversationId, userId: String(me._id) });
            }, 2000);
        },
        [me, socket]
    );

    const debouncedTyping = useMemo(() => debounce(handleTyping, 300), [handleTyping]);

    // 📤 Send text message
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!msgText.trim() || !me || !sel || isRateLimited) return;

        if (editingMessage) {
            try {
                const res = await fetch(`/api/messages/${editingMessage._id}/edit`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        newText: msgText.trim(),
                        messageId: editingMessage._id,
                    }),
                });
                if (!res.ok) {
                    toast.error("failed to edit message")
                    return;
                }
                socket.emit("message:edit", {
                    conversationId: String(sel),
                    messageId: String(editingMessage._id),
                    text: msgText.trim(),
                });
                updateEditedMessage(String(sel), String(editingMessage._id), msgText.trim());
                clearEditingMessage();
                setMsgText("");
            } catch (error) {
                console.error("Failed to edit message", error);
                toast.error("Failed to edit message");
            }
            return;
        }


        const tempId = uuidv4();
        const tempMessage: UIMessage = {
            _id: tempId,
            conversationId: String(sel),
            sender: {
                _id: String(me._id),
                username: me.username,
                profilePicture: me.profilePicture
            },
            content: msgText.trim(),
            messageType: "text",
            status: isOnline ? "pending" : "queued",
            isDeleted: false,
            createdAt: new Date(),
            isTemp: true,
        };

        addMessage(sel, tempMessage);
        setMsgText("");

        if (!isOnline || socket.disconnected) {
            await addToQueue({
                tempId,
                id: Number(tempId),
                conversationId: String(sel),
                senderId: String(me._id), // ✅ required
                content: tempMessage.content,
                messageType: tempMessage.messageType,
                createdAt: tempMessage.createdAt,
                status: "queued",
            });
            toast("Message queued. Will send when online.");
            return;
        }

        try {
            const res = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: tempMessage.content,
                    conversationId: sel,
                }),
            });

            if (res.status === 429) {
                triggerRateLimit(); // ✅ centralized
                return;
            }

            if (!res.ok) throw new Error("Failed to send message");
            const message = await res.json();

            sendMessage(message, conversationMembers);
            updateLastMessage(String(sel), message);
            replaceTempMessage(String(sel), tempId, message);
        } catch (err) {
            console.error("Send message failed:", err);
            toast.error("Message failed to send");
        }
    };

    // 🖼️ Handle image upload (same as before)
    const handleImageUpload = async (result: { url?: string; fileId?: string }) => {
        if (!result.url || !me || !sel) return;

        try {
            const res = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: result.url,
                    conversationId: sel,
                    senderId: me._id,
                    messageType: "image",
                }),
            });

            if (!res.ok) throw new Error("Failed to send image message");

            const message = await res.json();
            addMessage(String(sel), message);
            sendMessage(message, conversationMembers);
            toast.success("Image sent successfully!");
            setShowImageUpload(false);
        } catch (err) {
            console.error("Send image message failed:", err);
            toast.error("Failed to send image");
        }
    };

    return (<>
        {false && (
            <div className="bg-amber-600 flex items-center gap-2 ml-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span>typingText</span>
                <div className="flex space-x-1 animate-bounce">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                </div>
            </div>
        )}
        <div className="relative w-full max-w-3xl mx-auto px-2 sm:px-6 py-2 bg-gray-900/90 rounded-b-2xl shadow-lg border-t border-gray-800 flex flex-col gap-2">
            <form className="flex items-center gap-2 w-full" onSubmit={handleSendMessage}>
                {/* Emoji, Attach, Image */}
                <div className="flex items-center gap-1 sm:gap-2">
                    <button type="button" className="p-2 rounded-full hover:bg-gray-800 transition" aria-label="Add emoji">
                        <Laugh className="text-gray-400" size={22} />
                    </button>
                    <button type="button" className="p-2 rounded-full hover:bg-gray-800 transition" aria-label="Attach file">
                        <Plus className="text-gray-400" size={22} />
                    </button>
                    <button type="button" className="p-2 rounded-full hover:bg-gray-800 transition" aria-label="Upload image" onClick={() => setShowImageUpload(!showImageUpload)}>
                        <ImageIcon className="text-gray-400" size={22} />
                    </button>
                </div>
                {/* Input */}
                <div className="flex-1 relative">
                    {(activeReply || editingMessage) && (
                        <div className="absolute -top-10 left-0 w-full bg-gray-800 text-xs text-gray-200 p-2 rounded-t-md flex justify-between items-center z-10">
                            {activeReply && <span>Replying to: <span className="font-semibold">{activeReply.content}</span></span>}
                            {editingMessage && <span>Editing: <span className="font-semibold">{editingMessage.content}</span></span>}
                            <button
                                type="button"
                                className="ml-2 text-xs text-blue-400 hover:underline"
                                onClick={clearEditingMessage}
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                    <Input
                        type="text"
                        placeholder={isRateLimited ? `Please wait ${timeLeft}s...` : "Type a message"}
                        className="py-2 px-4 text-sm w-full rounded-full border border-gray-700 bg-gray-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500 transition shadow-sm"
                        value={msgText}
                        onChange={(e) => {
                            setMsgText(e.target.value);
                            if (sel && !isRateLimited) debouncedTyping(String(sel));
                        }}
                        disabled={isRateLimited}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                            }
                            if (e.key === "Escape") {
                                clearEditingMessage();
                            }
                        }}
                    />
                </div>
                {/* Send / Mic */}
                <div className="flex items-center gap-1">
                    {msgText.trim().length > 0 ? (
                        <Button
                            type="submit"
                            size="icon"
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow"
                            disabled={isRateLimited}
                            aria-label="Send message"
                        >
                            <Send size={20} />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            size="icon"
                            className="bg-gray-700 hover:bg-gray-600 text-white rounded-full p-2"
                            disabled={isRateLimited}
                            aria-label="Record voice"
                        >
                            <Mic size={20} />
                        </Button>
                    )}
                </div>
            </form>
            {/* Image upload popover */}
            {showImageUpload && (
                <div className="absolute bottom-full left-0 mb-2 w-64 p-4 border border-gray-700 rounded-xl bg-gray-900 shadow-xl z-20">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-medium text-white">Send Image</h3>
                        <button
                            onClick={() => setShowImageUpload(false)}
                            className="text-gray-400 hover:text-white"
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
    </>
    );
};

export default MessageInput;