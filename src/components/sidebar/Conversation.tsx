"use client";

import React, { memo } from "react";
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
    conversation: ClientConversation & {
        unreadCount?: number;
        isOnline?: boolean;
        isTyping?: boolean;
    };
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
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
      ${isActive ? "bg-gray-800/80 border-l-4 border-blue-500" : "hover:bg-gray-800/50"}
      `}
            onClick={() => setSelectedConversation(conversation)}
        >
            {/* Avatar */}
            <Avatar className="relative w-11 h-11 border border-gray-900">
                {conversation.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
                )}

                <AvatarImage
                    src={getAvatarUrl(conversationImage, 128)}
                    className="object-cover rounded-full"
                />

                <AvatarFallback>
                    <div className="animate-pulse bg-gray-700 w-full h-full rounded-full" />
                </AvatarFallback>
            </Avatar>

            {/* Conversation Content */}
            <div className="flex-1 min-w-0">
                {/* Name + time */}
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate text-white">
                        {conversationName}
                    </span>

                    <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                        {formatDate(
                            conversation?.updatedAt ??
                            conversation.createdAt ??
                            Date.now()
                        )}
                    </span>
                </div>

                {/* Message preview */}
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1 truncate">
                    {lastMessage?.sender === user?._id && <MessageSeenSvg />}

                    {conversation.isGroup && <Users size={14} />}

                    {conversation.isTyping ? (
                        <span className="text-green-400 italic">typing...</span>
                    ) : (
                        <>
                            {!lastMessage && <span>Say Hi 👋</span>}

                            {lastMessageType === "text" && lastMessage?.content && (
                                <span className="truncate">
                                    {lastMessage.content.length > 30
                                        ? `${lastMessage.content.slice(0, 30)}...`
                                        : lastMessage.content}
                                </span>
                            )}

                            {lastMessageType === "image" && (
                                <>
                                    <ImageIcon size={14} />
                                    <span>Photo</span>
                                </>
                            )}

                            {lastMessageType === "video" && (
                                <>
                                    <VideoIcon size={14} />
                                    <span>Video</span>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Unread badge */}
            {conversation.unreadCount ? (
                <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5 font-semibold">
                    {conversation.unreadCount}
                </span>
            ) : null}
        </div>
    );
};

export default memo(Conversation);