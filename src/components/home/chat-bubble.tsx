import { IMessagePopulated } from "@/models/Message";
import ChatBubbleAvatar from "./chat-bubble-avatar";

interface ChatBubbleProps {
    message: IMessagePopulated;
    isSender: boolean;
}

const ChatBubble = ({ message, isSender }: ChatBubbleProps) => {
    console.log(message)
    return (
        <div className={`flex ${isSender ? 'justify-end' : 'justify-start'} px-2`}>
            <ChatBubbleAvatar
                isGroup={false}
                isMember={false}
                message={message}
            />
            <div className="flex flex-col items-end max-w-[70%]">
                <div
                    className={`w-full p-3 rounded-xl shadow-md transition duration-300 ease-in-out
                        ${isSender
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                >
                    {/* Message content */}
                    <p className="text-sm">{message.content}</p>
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


