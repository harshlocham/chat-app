'use client';

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

// type guard
function isUser(p: unknown): p is ClientUser {
    return typeof p === "object" && p !== null && "username" in p;
}

const Conversation = ({ conversation }: ConversationProps) => {
    const { data: session } = useSession();
    const { user } = useUser();
    const currentUserEmail = session?.user?.email;

    const { setSelectedConversation, selectedConversationId, onlineUsers } = useChatStore();

    const otherUser = conversation.participants.find(
        (p): p is ClientUser =>
            isUser(p) && p.email !== currentUserEmail
    );

    const conversationImage =
        conversation.image || otherUser?.profilePicture || "";
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

    const isActive =
        selectedConversationId === String(conversation._id);
    const isDirectOnline = Boolean(
        !conversation.isGroup &&
        otherUser?._id &&
        onlineUsers.includes(String(otherUser._id))
    );

    return (
        <>
            <div
                className={`flex gap-2 items-center p-3 hover:bg-chat-hover cursor-pointer
          ${isActive ? "bg-[hsl(var(--gray-tertiary))]" : ""}
        `}
                onClick={() => setSelectedConversation(conversation)}
            >
                <Avatar className="border border-gray-900 overflow-visible relative">
                    {isDirectOnline && (
                        <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-foreground" />
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

                <div className="w-full">
                    <div className="flex items-center">
                        <h3 className="text-sm font-medium">
                            {conversationName}
                        </h3>

                        <span className="text-xs text-gray-500 ml-auto">
                            {formatDate(
                                (conversation?.updatedAt
                                ) ??
                                (conversation.createdAt
                                ) ??
                                Date.now()
                            )}
                        </span>
                    </div>

                    <p className="text-[12px] mt-1 text-gray-500 flex items-center gap-1">
                        {lastMessage?.sender === user?._id && <MessageSeenSvg />}
                        {conversation.isGroup && <Users size={16} />}

                        {!lastMessage && "Say Hi!"}

                        {lastMessageType === "text" && lastMessage?.content && (
                            <span>
                                {lastMessage.content.length > 30
                                    ? `${lastMessage.content.slice(0, 30)}...`
                                    : lastMessage.content}
                            </span>
                        )}

                        {lastMessageType === "image" && <ImageIcon size={16} />}
                        {lastMessageType === "video" && <VideoIcon size={16} />}
                    </p>
                </div>
            </div>

            <hr className="h-[1px] mx-10 bg-gray-primary" />
        </>
    );
};

export default Conversation;