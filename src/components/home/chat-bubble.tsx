import { IMessagePopulated } from "@/models/Message";
import ChatBubbleAvatar from "./chat-bubble-avatar";
import { useConversationStore } from "@/store/chat-store";
import { Image } from "@imagekit/next";
import { VideoIcon } from "lucide-react";


interface ChatBubbleProps {
    message: IMessagePopulated;
    isSender: boolean;
}

const ChatBubble = ({ message, isSender }: ChatBubbleProps) => {
    //console.log(message)
    const { selectedConversation } = useConversationStore();
    return (
        <div className={`flex ${isSender ? 'justify-end' : 'justify-start'} px-2`}>
            {!isSender && selectedConversation?.isGroup && (
                <ChatBubbleAvatar
                    isGroup={selectedConversation?.isGroup}
                    isMember={true}
                    message={message}
                />
            )}

            <div className="flex flex-col items-end max-w-[70%]">
                <div
                    className={`w-full rounded-xl  transition duration-300 ease-in-out
                        ${isSender
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }
                        ${message.messageType !== "text" ? "p-0 bg-transparent shadow-none" : "p-3 shadow-md"}
                        `}
                >
                    {/* Message content based on type */}
                    {message.messageType === "text" && (
                        <p className="text-sm">{message.content}</p>
                    )}

                    {message.messageType === "image" && (
                        <div className="max-w-xs">
                            <Image
                                urlEndpoint={process.env.NEXT_PUBLIC_URI_ENDPOINT as string}
                                src={message.content}
                                alt="Message image"
                                width={300}
                                height={200}
                                className="rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity max-w-full h-auto"
                                onClick={() => window.open(message.content, '_blank')}
                            />
                        </div>
                    )}

                    {message.messageType === "video" && (
                        <div className="flex items-center gap-2">
                            <VideoIcon size={20} />
                            <span className="text-sm">Video message</span>
                        </div>
                    )}
                </div>
                {/* Timestamp below the bubble */}
                <span className={`text-[10px] text-gray-400 mt-1 block ${isSender ? 'text-right' : 'text-left'} w-full`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
};
export default ChatBubble;

