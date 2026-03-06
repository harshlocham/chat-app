"use client";

import { formatDate } from "@/lib/utils/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { MessageSeenSvg } from "@/lib/utils/svgs";
import { ImageIcon, Users, VideoIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { getAvatarUrl } from "@/lib/utils/imagekit";
import { useUser } from "@/context/UserContext";
import useChatStore from "@/store/chat-store";
import { ClientConversation } from "@/shared/types/client-conversation";
import { ClientUser } from "@/shared/types/user";

type ConversationProps = {
    conversation: ClientConversation & { unreadCount?: number };
};

function isUser(p: unknown): p is ClientUser {
    return typeof p === "object" && p !== null && "username" in p;
}

const Conversation = ({ conversation }: ConversationProps) => {
    const { data: session } = useSession();
    const { user } = useUser();
    const currentUserEmail = session?.user?.email;
    const { setSelectedConversation, selectedConversationId } = useChatStore();

    const otherUser = conversation.participants.find(
        (p): p is ClientUser => isUser(p) && p.email !== currentUserEmail
    );

    const conversationImage =
        conversation.image || otherUser?.profilePicture || "";

    const conversationName = conversation.isGroup
        ? conversation.groupName
        : otherUser?.username || "Unknown";

    const lastMessage = conversation.lastMessage;
    const lastMessageType = lastMessage?.messageType;

    const isActive = selectedConversationId === String(conversation._id);

    return (
        <div
            className={`flex gap-3 items-center px-4 py-3 rounded-lg transition-colors cursor-pointer
                ${isActive ? "bg-gray-800/80 border border-blue-500 shadow" : "hover:bg-gray-800/60"}
            `}
            onClick={() => setSelectedConversation(conversation)}
        >
            <div className="relative">
                <Avatar className="w-11 h-11 border border-gray-900">
                    <AvatarImage
                        src={getAvatarUrl(conversationImage, 128)}
                        className="object-cover rounded-full"
                    />
                    <AvatarFallback>
                        <div className="animate-pulse bg-gray-700 w-full h-full rounded-full" />
                    </AvatarFallback>
                </Avatar>
                {/* Online status dot */}
                {otherUser?.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-sm text-white">{conversationName}</span>
                    <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                        {formatDate(conversation?.updatedAt ?? conversation.createdAt ?? Date.now())}
                    </span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400 min-w-0">
                    {lastMessage?.sender === user?._id && <MessageSeenSvg />}
                    {conversation.isGroup && <Users size={14} className="text-gray-500" />}
                    {!lastMessage && <span className="italic text-gray-500">Say Hi!</span>}
                    {lastMessageType === "text" && lastMessage?.content && (
                        <span className="truncate max-w-[120px]">{lastMessage.content.length > 30 ? `${lastMessage.content.slice(0, 30)}...` : lastMessage.content}</span>
                    )}
                    {lastMessageType === "image" && <ImageIcon size={14} className="text-gray-400" />}
                    {lastMessageType === "video" && <VideoIcon size={14} className="text-gray-400" />}
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