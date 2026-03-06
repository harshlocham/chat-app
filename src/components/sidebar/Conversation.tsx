"use client";

import { formatDate } from "@/lib/utils/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { ClientConversation } from "@/shared/types/client-conversation";

type ConversationProps = {
    conversation: ClientConversation & { unreadCount?: number };
    onSelect: (id: string) => void;
    active: boolean;
};

const Conversation = ({ conversation, onSelect, active }: ConversationProps) => {
    return (
        <div
            className={`flex gap-3 items-center px-4 py-3 rounded-lg transition-colors cursor-pointer ${active ? "bg-gray-800/80 border border-blue-500 shadow" : "hover:bg-gray-800/60"}`}
            onClick={() => onSelect(conversation._id)}
        >
            <Avatar className="w-11 h-11 border border-gray-900">
                <AvatarImage
                    src={conversation.image || ""}
                    className="object-cover rounded-full"
                />
                <AvatarFallback>
                    <div className="animate-pulse bg-gray-700 w-full h-full rounded-full" />
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-sm text-white">{conversation.isGroup ? conversation.groupName : "User"}</span>
                    <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                        {formatDate(conversation?.updatedAt ?? conversation.createdAt ?? Date.now())}
                    </span>
                </div>
            </div>
            {/* Unread badge */}
            {conversation.unreadCount ? (
                <span className="ml-2 bg-blue-600 text-white text-xs rounded-full px-2 py-0.5 font-semibold">
                    {conversation.unreadCount}
                </span>
            ) : null}
        </div>
    );
};

export default Conversation;
export { Conversation };