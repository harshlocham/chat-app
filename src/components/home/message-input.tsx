'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Laugh, Mic, Plus, Send, Image as ImageIcon } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { getMe } from "@/lib/utils/api";
import useChatStore from "@/store/chat-store";
import { getSocket } from "@/lib/socket/socketClient";
import { ClientUser } from "@/shared/types/user";
import { ImageUpload } from "./ImageUpload";
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

        addMessage(tempId, tempMessage);
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
        <div className="relative bg-gray-primary p-2 flex gap-4 items-center">
            <div className="relative flex gap-2 ml-2">
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
                    {/* Reply or Edit Preview */}
                    {(activeReply || editingMessage) && (
                        <div className="absolute -top-8 left-3 w-lg bg-gray-100 dark:bg-gray-800 text-sm p-2 rounded-t-md flex justify-between">
                            {activeReply && <span>Replying to: {activeReply.content}</span>}
                            {editingMessage && <span>Editing: {editingMessage.content}</span>}
                            <button
                                type="button"
                                className="text-xs text-blue-500"
                                onClick={clearEditingMessage}
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    <Input
                        type="text"
                        placeholder={
                            isRateLimited
                                ? `Please wait ${timeLeft}s...`
                                : "Type a message"
                        }
                        className="py-2 text-sm w-full rounded-lg shadow-sm bg-[hsl(var(--gray-tertiary))] focus-visible:ring-transparent"
                        value={msgText}
                        onChange={(e) => {
                            setMsgText(e.target.value);
                            if (sel && !isRateLimited)
                                debouncedTyping(String(sel));
                        }}
                        disabled={isRateLimited}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                            }
                            if (e.key === "Escape") {
                                clearEditingMessage()
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
                            disabled={isRateLimited}
                        >
                            <Send />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            className="bg-transparent text-[hsl(var(--foreground))] hover:bg-transparent"
                            disabled={isRateLimited}
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
    </>
    );
};

export default MessageInput;