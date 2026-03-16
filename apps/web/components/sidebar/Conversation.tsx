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

    const {
        setSelectedConversation,
        selectedConversationId,
        onlineUsers,
        typingByConversation,
        currentUserId,
    } = useChatStore();

    const otherUser = conversation.participants.find(
        (p): p is ClientUser => isUser(p) && p.email !== currentUserEmail
    );

    const conversationImage = conversation.isGroup
        ? conversation.image || ""
        : otherUser?.profilePicture || conversation.image || "";
    const avatarSrc = conversationImage
        ? getAvatarUrl(conversationImage, 128)
        : undefined;

    const conversationName = conversation.isGroup
        ? conversation.groupName
        : otherUser?.username || "Unknown";

    const avatarFallbackInitial =
        conversationName?.trim().charAt(0).toUpperCase() || "U";

    const lastMessage = conversation.lastMessage;
    const lastMessageType = lastMessage?.messageType;

    const isActive = selectedConversationId === String(conversation._id);
    const isDirectOnline = Boolean(
        !conversation.isGroup &&
        otherUser?._id &&
        onlineUsers.includes(String(otherUser._id))
    );

    const typingUserIds = typingByConversation[String(conversation._id)] || [];
    const typingUserNames = Array.from(
        new Set(
            typingUserIds
                .filter((userId) => userId && userId !== currentUserId)
                .map((userId) => {
                    const participant = conversation.participants.find(
                        (p): p is ClientUser =>
                            isUser(p) && String(p._id) === String(userId)
                    );

                    return participant?.username || "Someone";
                })
        )
    );

    const typingPreview =
        typingUserNames.length === 1
            ? `${typingUserNames[0]} typing...`
            : typingUserNames.length > 1
                ? "typing..."
                : null;

    const onlineDotBorderClass = isActive
        ? "border-[hsl(var(--card))]"
        : "border-[hsl(var(--left-panel))]";

    return (
        <div
            className={`relative flex items-center gap-3 px-4 py-3 min-h-[72px] cursor-pointer transition-colors
      ${isActive ? "bg-[hsl(var(--card))]" : "hover:bg-[hsl(var(--chat-hover))]"}
      `}
            onClick={() => setSelectedConversation(conversation)}
        >
            {isActive ? (
                <span className="absolute inset-y-0 left-0 w-1 bg-blue-500" />
            ) : null}

            {/* Avatar */}
            <Avatar className="relative w-11 h-11 shrink-0 overflow-visible border border-[hsl(var(--border))]">
                {isDirectOnline && (
                    <span
                        className={`absolute -bottom-0.5 -right-0.5 z-10 h-3 w-3 rounded-full bg-green-500 border-2 ${onlineDotBorderClass}`}
                    />
                )}

                <AvatarImage
                    src={avatarSrc}
                    alt={conversationName || "User avatar"}
                    className="object-cover rounded-full"
                />

                <AvatarFallback className="bg-slate-700 text-slate-100 text-sm font-semibold">
                    {avatarFallbackInitial}
                </AvatarFallback>
            </Avatar>

            {/* Conversation Content */}
            <div className="flex-1 min-w-0">
                {/* Name + time */}
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate text-[hsl(var(--foreground))]">
                        {conversationName}
                    </span>

                    <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto whitespace-nowrap">
                        {formatDate(
                            conversation?.updatedAt ??
                            conversation.createdAt ??
                            Date.now()
                        )}
                    </span>
                </div>

                {/* Message preview */}
                <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] mt-1 truncate">
                    {lastMessage?.sender === user?._id && <MessageSeenSvg />}

                    {conversation.isGroup && <Users size={14} />}

                    {typingPreview ? (
                        <span className="text-green-400 italic">{typingPreview}</span>
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