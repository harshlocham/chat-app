import React from "react";
import useChatStore from "@/store/chat-store";
import { Image } from "@imagekit/next";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import {
    Smile,
    MessageCircle,
    Edit,
    Trash2,
    Paperclip,
} from "lucide-react";
import { ReactionBar } from "../chat/reaction-bar";
import { ClientUser } from "@chat/types";
import { motion, AnimatePresence } from "framer-motion";
import { UIMessage } from "@chat/types";
import ChatBubbleAvatar from "../home/chat-bubble-avatar";

interface ChatBubbleProps {
    message: UIMessage;
    currentUserId: string;
    onDelete: (msgId: string) => void;
    onReply: (msg: UIMessage) => void;
    onReact: (msg: UIMessage, emoji: string) => void;
    showAvatar?: boolean;
    showUsername?: boolean;
}

// --------- Small helpers ---------
function isUser(obj: unknown): obj is ClientUser {
    return (
        typeof obj === "object" &&
        obj !== null &&
        "username" in obj &&
        typeof (obj as ClientUser).username === "string"
    );
}

function isPopulatedMessage(obj: unknown): obj is UIMessage {
    return (
        typeof obj === "object" &&
        obj !== null &&
        "content" in obj &&
        "sender" in obj
    );
}

function getFileNameFromUrl(url: string) {
    try {
        const withoutQuery = url.split("?")[0];
        const parts = withoutQuery.split("/");
        return parts[parts.length - 1] || "file";
    } catch {
        return "file";
    }
}

const ChatBubble = ({
    message,
    currentUserId,
    onDelete,
    onReply,
    onReact,
    showAvatar = true,
    showUsername = true,
}: ChatBubbleProps) => {
    const { selectedConversation, setEditingMessage } = useChatStore();
    const [showReactions, setShowReactions] = useState(false);
    //const [hovered, setHovered] = useState(false);
    const senderId =
        typeof message.sender === "string"
            ? message.sender
            : message.sender?._id;

    const isMine = String(senderId) === String(currentUserId);
    // reactions: { emoji: string; users: (string | {_id:string})[] }[]
    const rawReactions = message.reactions ?? [];

    // Group by emoji
    const groupedReactions = rawReactions.reduce((acc, r) => {
        if (!acc[r.emoji]) {
            acc[r.emoji] = [];
        }

        acc[r.emoji].push(...r.users); // spread array
        return acc;
    }, {} as Record<string, string[]>);

    const hasReactions = Object.keys(groupedReactions).length > 0;

    const receiptState = (() => {
        if (!isMine) return null;

        if (message.status === "pending" || message.status === "queued") {
            return "sending" as const;
        }

        if (message.status === "seen" || message.seen || (message.seenBy?.length ?? 0) > 0) {
            return "seen" as const;
        }

        if (
            message.status === "delivered" ||
            message.delivered ||
            (message.deliveredTo?.length ?? 0) > 0
        ) {
            return "delivered" as const;
        }

        return "sent" as const;
    })();

    const getRepliedPreview = () => {
        const replied = (message).repliedTo;

        if (!replied) return null;
        if (!isPopulatedMessage(replied)) {
            // Not populated, just show a generic line
            return (
                <span className="text-xs italic opacity-70">
                    Replying to a message…
                </span>
            );
        }

        const repliedSender = replied.sender;
        let name = "Someone";
        if (isUser(repliedSender)) {
            name =
                repliedSender._id?.toString() === currentUserId
                    ? "You"
                    : repliedSender.username;
        }

        let snippet: string;
        switch (replied.messageType) {
            case "image":
                snippet = "📷 Image";
                break;
            case "video":
                snippet = "📹 Video";
                break;
            case "audio":
            case "voice":
                snippet = "🎧 Audio message";
                break;
            case "file":
                snippet = `📎 ${getFileNameFromUrl(replied.content)}`;
                break;
            default:
                snippet = replied.content;
        }

        return (
            <div
                className="text-xs text-gray-500 dark:text-gray-300 bg-black/5 dark:bg-white/5 rounded-md p-2 mb-2 border-l-2 border-gray-300 dark:border-gray-700 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition"
                onClick={() => {
                    const origId = message.repliedTo?._id;
                    if (origId) {
                        document.getElementById(origId)?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }}
            >
                <div className="font-semibold mb-0.5">{name}</div>
                <div className="line-clamp-2 break-words opacity-80">{snippet}</div>
            </div>
        );
    };

    const renderContent = () => {
        if (message.isDeleted) {
            return (
                <div className="text-xs text-gray-400 border-l-2 pl-2 mb-1 border-gray-300 dark:border-gray-700">
                    <p className="text-sm break-words">This message was deleted</p>
                </div>
            );
        }

        const type = (message).messageType as
            | "text"
            | "image"
            | "video"
            | "audio"
            | "voice"
            | "file";

        switch (type) {
            case "image":
                return (
                    <Image
                        urlEndpoint={process.env.NEXT_PUBLIC_URI_ENDPOINT as string}
                        src={message.content}
                        alt="Message image"
                        width={320}
                        height={240}
                        className="rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity max-w-full h-auto"
                        onClick={() => window.open(message.content, "_blank")}
                    />
                );

            case "video":
                return (
                    <video
                        controls
                        className="rounded-lg cursor-pointer max-w-full h-auto"
                    >
                        <source src={message.content} type="video/mp4" />
                        Your browser does not support the video tag.
                    </video>
                );

            case "audio":
            case "voice":
                return (
                    <audio
                        controls
                        className="w-full max-w-xs"
                    >
                        <source src={message.content} />
                        Your browser does not support the audio element.
                    </audio>
                );

            case "file":
                return (
                    <a
                        href={message.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                        <Paperclip className="w-4 h-4" />
                        <span className="text-xs break-all line-clamp-1">
                            {getFileNameFromUrl(message.content)}
                        </span>
                    </a>
                );

            case "text":
            default:
                return <p className="text-sm break-words">{message.content}</p>;
        }
    };

    return (
        <div
            id={String(message._id)}
            className={`flex w-full ${isMine ? "justify-end" : "justify-start"} px-1 sm:px-2`}
        >
            {/* Avatar only for others in group chats, and only if showAvatar */}
            {!isMine && selectedConversation?.isGroup && isUser(message.sender) && showAvatar && (
                <ChatBubbleAvatar
                    isGroup={selectedConversation?.isGroup}
                    isMember={true}
                    sender={message.sender}
                />
            )}
            <div
                className={`relative flex flex-col max-w-[90vw] sm:max-w-[70%] group ${isMine ? "items-end" : "items-start"}`}
            >
                {/* Username for first message in group */}
                {!isMine && showUsername && selectedConversation?.isGroup && isUser(message.sender) && (
                    <div className="text-xs font-semibold text-gray-400 mb-1">
                        {message.sender.username}
                    </div>
                )}
                {/* Modern SaaS-style reaction badges */}
                {hasReactions && !message.isDeleted && (
                    <div className={`absolute -top-3 ${isMine ? "right-4" : "left-4"} flex gap-1 z-20`}>
                        <AnimatePresence>
                            {Object.entries(groupedReactions).map(([emoji, users]) => {
                                const reactedByMe = users.some((u) => String(u) === String(currentUserId));
                                return (
                                    <motion.span
                                        key={emoji}
                                        initial={{ scale: 0, y: 6, opacity: 0 }}
                                        animate={{ scale: 1, y: 0, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        transition={{ type: "spring", stiffness: 350, damping: 20 }}
                                        className={`px-2 py-[2px] text-[11px] rounded-full shadow ${reactedByMe ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-200"}`}
                                    >
                                        {emoji}
                                        {users.length > 1 && ` ${users.length}`}
                                    </motion.span>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
                <div
                    className={`w-full rounded-2xl transition duration-300 ease-in-out relative
                        ${isMine
                            ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
                            : "bg-gray-800/80 text-gray-100 border border-gray-700"
                        }
                        ${(message).messageType !== "text"
                            ? "p-0 bg-transparent shadow-none"
                            : "p-4 shadow-sm"
                        }
                        `}
                >
                    {/* Reply preview (full: name + snippet) */}
                    {(message).repliedTo && getRepliedPreview()}

                    {/* Main content */}
                    {renderContent()}

                    {/* Dropdown for message actions (fallback for mobile) */}
                    {("isDeleted" in message ? !message.isDeleted : true) && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="z-10 absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                                    <span className="text-white">•••</span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side={isMine ? "left" : "right"}>
                                <DropdownMenuItem onClick={() => setShowReactions(true)}>
                                    <Smile className="w-4 h-4 mr-2" /> React
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onReply(message)}>
                                    <MessageCircle className="w-4 h-4 mr-2" /> Reply
                                </DropdownMenuItem>
                                {isMine && (
                                    <>
                                        {message.messageType === "text" && (<DropdownMenuItem
                                            onClick={() =>
                                                setEditingMessage(message)

                                            }
                                        >
                                            <Edit className="w-4 h-4 mr-2" /> Edit
                                        </DropdownMenuItem>)}
                                        <DropdownMenuItem
                                            onClick={() => onDelete(message._id)}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2 text-red-500" /> Delete
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                {/* Reaction picker bar */}
                {showReactions && (
                    <ReactionBar
                        onSelect={(emoji: string) => {
                            onReact(message, emoji);

                            setShowReactions(false);
                        }}
                    />
                )}

                {/* Timestamp */}
                <div className="flex items-center gap-1 mt-1">
                    <span
                        className={`text-[10px] text-gray-400 block ${isMine ? "text-right ml-auto" : "text-left"} w-full`}
                    >
                        {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                    {receiptState === "sending" && (
                        <span className="ml-1 text-gray-400 text-xs">...</span>
                    )}
                    {receiptState === "sent" && (
                        <span className="ml-1 text-gray-400 text-xs">✓</span>
                    )}
                    {receiptState === "delivered" && (
                        <span className="ml-1 text-gray-400 text-xs">✓✓</span>
                    )}
                    {receiptState === "seen" && (
                        <span className="ml-1 text-blue-400 text-xs">✓✓</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatBubble;