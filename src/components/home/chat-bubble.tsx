import { getMe } from "@/lib/api";
import { IMessage } from "@/models/Message";

interface ChatBubbleProps {
    message: IMessage;
    isSender: boolean;
}

const ChatBubble = ({ message, isSender }: ChatBubbleProps) => {
    return (
        <div className={`flex ${isSender ? 'justify-end' : 'justify-start'} px-2`}>
            <div
                className={`max-w-[70%] p-3 rounded-xl shadow-md transition duration-300 ease-in-out
                    ${isSender
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
            >
                {/* Message content */}
                <p className="text-sm">{message.content}</p>

                {/* Optional timestamp styling */}
                <span className="text-[10px] text-gray-400 mt-1 block text-right">
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
};
export default ChatBubble;


