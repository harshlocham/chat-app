'use client';
import { Laugh, Mic, Plus, Send, Image as ImageIcon } from "lucide-react";
import { Input } from "../ui/input";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { getMe } from "@/lib/api";
//import { socket } from "@/lib/socketClient";
import { useConversationStore } from "@/store/chat-store";
import { socket } from "@/lib/socketClient";
import { IUser } from "@/models/User";
import { ImageUpload } from "./ImageUpload";
import toast from "react-hot-toast";




const MessageInput = () => {
    const [msgText, setMsgText] = useState("");
    const [me, setMe] = useState<IUser | null>(null);
    const [showImageUpload, setShowImageUpload] = useState(false);
    const addMessage = useConversationStore(s => s.addMessage);
    const sel = useConversationStore(s => s.selectedConversation);

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
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!msgText || !me) return;
        // console.log("Sending message:", {
        //     content: msgText,
        //     conversationId: sel?._id,
        //     senderId: me?._id,
        // });

        try {
            const res = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: msgText,
                    conversationId: sel?._id,
                    senderId: me._id,
                }),
            });

            if (!res.ok) throw new Error("Failed to send message");

            const message = await res.json();
            addMessage(message);
            socket.emit("message:send", message);
            // Local update (Socket.IO will broadcast too)
            setMsgText("");
        } catch (err) {
            console.error("Send message failed:", err);
        }

    }

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
    }
    let typingTimeout: NodeJS.Timeout;

    function handleTyping(conversationId: string) {
        socket.emit("typing", conversationId, me!.username as string);

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit("stopTyping", conversationId, me!.username);
        }, 2000);
    }

    return (
        <div className='relative bg-gray-primary p-2 flex gap-4 items-center'>
            <div className='relative flex gap-2 ml-2'>
                {/* EMOJI PICKER WILL GO HERE */}
                <Laugh className='text-gray-600 dark:text-gray-400' />
                <Plus className='text-gray-600 dark:text-gray-400' />
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
            <form className='w-full flex gap-3' onSubmit={handleSendMessage}>
                <div className='flex-1'>
                    <Input
                        type='text'
                        placeholder='Type a message'
                        className='py-2 text-sm w-full rounded-lg shadow-sm bg-[hsl(var(--gray-tertiary))] focus-visible:ring-transparent'
                        value={msgText}
                        onChange={(e) => {
                            setMsgText(e.target.value);
                            if (sel?._id) handleTyping(String(sel._id));
                        }}
                    />
                </div>
                <div className='mr-4 flex items-center gap-3'>
                    {msgText.length > 0 ? (
                        <Button
                            type='submit'
                            size={"sm"}
                            className='bg-transparent text-[hsl(var(--foreground))] hover:bg-transparent'
                        >
                            <Send />
                        </Button>
                    ) : (
                        <Button
                            type='submit'
                            size={"sm"}
                            className='bg-transparent text-[hsl(var(--foreground))] hover:bg-transparent'
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
                            if (progress === 100) {
                                toast.success("Image uploaded successfully!");
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
};
export default MessageInput;