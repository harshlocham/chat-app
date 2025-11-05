import { IMessage, IMessagePopulated } from "@/models/Message";
import ChatBubbleAvatar from "./chat-bubble-avatar";
import { useConversationStore } from "@/store/chat-store";
import { Image } from "@imagekit/next";
import { ITempMessage } from "@/models/TempMessage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { Smile, MessageCircle, Edit, Trash2 } from "lucide-react";
// Import ReactionBar if it exists:
import { ReactionBar } from "../chat/reaction-bar";
import { IUser } from "@/models/User";


interface ChatBubbleProps {
    message: ITempMessage | IMessage;
    currentUserId: string;
    onEdit: (id: string, newText: string) => void;
    onDelete: (msgId: string) => void;
    onReply: (msg: IMessagePopulated | IMessage | ITempMessage) => void;
    onReact: (msg: IMessagePopulated | IMessage | ITempMessage, emoji: string) => void;
}

const ChatBubble = ({
    message,
    currentUserId,
    onEdit,
    onDelete,
    onReply,
    onReact,
}: ChatBubbleProps) => {
    const { selectedConversation } = useConversationStore();
    const [showReactions, setShowReactions] = useState(false);

    function isUser(obj: unknown): obj is IUser {
        return (
            typeof obj === "object" &&
            obj !== null &&
            "username" in obj &&
            typeof (obj as IUser).username === "string"
        );
    }

    const isMine =
        typeof message.sender === "string"
            ? message.sender === currentUserId
            : isUser(message.sender) && message.sender._id?.toString() === currentUserId;

    return (
        <div className={`flex ${isMine ? "justify-end" : "justify-start"} px-2`}>
            {/* Show avatar only for others in group chats */}
            {!isMine && selectedConversation?.isGroup && isUser(message.sender) && (
                <ChatBubbleAvatar
                    isGroup={selectedConversation.isGroup}
                    isMember={true}
                    sender={message.sender}
                />
            )}

            <div className="relative flex flex-col items-end max-w-[70%]">
                <div
                    className={`w-full rounded-xl transition duration-300 ease-in-out
                    ${isMine
                            ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                            : "bg-gray-100 text-gray-800"}
                    ${message.messageType !== "text"
                            ? "p-0 bg-transparent shadow-none"
                            : "p-3 shadow-md"}
                    `}
                >
                    {/* Replied Message Preview */}
                    {message.repliedTo && (
                        <div className="text-xs text-gray-400 border-l-2 pl-2 mb-1 border-gray-300 dark:border-gray-700">
                            {/* Replying to: {message.repliedTo.content} */}
                        </div>
                    )}

                    {/* Message content */}
                    {message.isDeleted ? (
                        <div className="text-xs text-gray-400 border-l-2 pl-2 mb-1 border-gray-300 dark:border-gray-700">
                            <p className="text-sm break-words">This message was deleted</p>
                        </div>
                    ) : (
                        <>
                            {message.messageType === "text" && (
                                <p className="text-sm break-words">{message.content}</p>
                            )}
                            {message.messageType === "image" && (
                                <Image
                                    urlEndpoint={process.env.NEXT_PUBLIC_URI_ENDPOINT as string}
                                    src={message.content}
                                    alt="Message image"
                                    width={320}
                                    height={240}
                                    className="rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity max-w-full h-auto"
                                    onClick={() => window.open(message.content, "_blank")}
                                />
                            )}
                            {message.messageType === "video" && (
                                <video
                                    controls
                                    className="rounded-lg cursor-pointer max-w-full h-auto"
                                >
                                    <source src={message.content} type="video/mp4" />
                                    Your browser does not support the video tag.
                                </video>
                            )}
                        </>
                    )}


                </div>

                {/* Dropdown for message actions */}
                {('isDeleted' in message ? !message.isDeleted : true) && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="z-10 absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                                <span className="text-white" >•••</span>

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
                                    <DropdownMenuItem onClick={() => onEdit(message._id as string, message.content)}>
                                        <Edit className="w-4 h-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onDelete(message._id as string)}>
                                        <Trash2 className="w-4 h-4 mr-2 text-red-500" /> Delete
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {/* Reaction Bar */}
                {showReactions && (
                    <ReactionBar
                        onSelect={(emoji: string) => {
                            onReact(message, emoji);
                            setShowReactions(false);
                        }}
                    />
                )}

                {/* Timestamp */}
                <span
                    className={`text-[10px] text-gray-400 mt-1 block ${isMine ? "text-right" : "text-left"} w-full`}
                >
                    {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </span>
            </div>
        </div>
    );
};

export default ChatBubble;
