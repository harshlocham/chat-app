import { IMessagePopulated } from "@/models/Message";
import ChatBubbleAvatar from "./chat-bubble-avatar";
import { useConversationStore } from "@/store/chat-store";
import { Image } from "@imagekit/next";
import { ITempMessage } from "@/models/TempMessage";
//import { VideoIcon } from "lucide-react";

interface ChatBubbleProps {
    message: IMessagePopulated | ITempMessage;
    currentUserId: string; // ✅ pass only current user id
}

const ChatBubble = ({ message, currentUserId }: ChatBubbleProps) => {
    const { selectedConversation } = useConversationStore();

    // ✅ Works whether sender is populated object or just id string
    const isSender =
        (message.sender && typeof message.sender === "object" && "toString" in message.sender
            ? message.sender._id?.toString() === currentUserId
            : message.sender === currentUserId);

    return (
        <div className={`flex ${isSender ? "justify-end" : "justify-start"} px-2`}>
            {/* Show avatar only for other users in group chats */}
            {!isSender && selectedConversation?.isGroup && (
                <ChatBubbleAvatar
                    isGroup={selectedConversation?.isGroup}
                    isMember={true}
                    sender={message.sender}
                />
            )}

            <div className="flex flex-col items-end max-w-[70%]">
                <div
                    className={`w-full rounded-xl transition duration-300 ease-in-out
            ${isSender
                            ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                            : "bg-gray-100 text-gray-800"
                        }
            ${message.messageType !== "text"
                            ? "p-0 bg-transparent shadow-none"
                            : "p-3 shadow-md"
                        }
          `}
                >
                    {/* Message content */}
                    {message.messageType === "text" && (
                        <p className="text-sm">{message.content}</p>
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
                </div>

                {/* Timestamp */}
                <span
                    className={`text-[10px] text-gray-400 mt-1 block ${isSender ? "text-right" : "text-left"
                        } w-full`}
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