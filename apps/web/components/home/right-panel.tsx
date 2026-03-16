"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    // Video,
    X
} from "lucide-react";
import MessageInput from "../chat/message-input";
import MessageContainer from "../chat/message-container";
import ChatPlaceHolder from "@/components/home/chat-placeholder";
import GroupMembersDialog from "./group-members-dialog";
import useChatStore from "@/store/chat-store";
import { useSession } from "next-auth/react";
import { ClientUser } from "@/shared/types/user";
import { getAvatarUrl } from "@/lib/utils/imagekit";
import TypingIndicator from "./typing-indicator";

// type guard
function isUser(p: ClientUser) {
    return typeof p === "object" && p !== null && "email" in p;
}

const RightPanel = () => {
    const { data: session } = useSession();
    const currentUserEmail = session?.user?.email;

    const conversations = useChatStore((s) => s.conversations);
    const selectedConversationId = useChatStore(
        (s) => s.selectedConversationId
    );
    const setSelectedConversation = useChatStore(
        (s) => s.setSelectedConversation
    );

    // 🔑 derive selected conversation (SINGLE SOURCE OF TRUTH)
    const selectedConversation = conversations.find(
        (c) => String(c._id) === selectedConversationId
    );

    if (!selectedConversation) {
        return <ChatPlaceHolder />;
    }

    // safely derive other user
    const otherUser = selectedConversation.participants.find(
        (p) =>
            isUser(p) && p.email !== currentUserEmail
    );

    const conversationName = selectedConversation.isGroup
        ? selectedConversation.groupName
        : otherUser?.username || "Unknown";

    const rawAvatarSrc = selectedConversation.isGroup
        ? selectedConversation.image
        : otherUser?.profilePicture || selectedConversation.image;
    const avatarSrc = rawAvatarSrc ? getAvatarUrl(rawAvatarSrc, 128) : undefined;
    const avatarFallbackInitial =
        conversationName?.trim().charAt(0).toUpperCase() || "U";

    return (
        <div className="w-3/4 flex flex-col">
            {/* Header */}
            <div className="w-full sticky top-0 z-50">
                <div className="flex justify-between bg-gray-primary p-3">
                    <div className="flex gap-3 items-center">
                        <Avatar>
                            <AvatarImage
                                src={avatarSrc}
                                alt={conversationName || "User avatar"}
                                className="object-cover"
                            />
                            <AvatarFallback className="bg-slate-700 text-slate-100 text-sm font-semibold">
                                {avatarFallbackInitial}
                            </AvatarFallback>
                        </Avatar>

                        <div className="flex flex-col">
                            <p>{conversationName}</p>
                            {selectedConversation.isGroup && (
                                <GroupMembersDialog />
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-7 mr-5">
                        {/* <a href="/video-call" target="_blank">
                            <Video size={23} />
                        </a> */}
                        <X
                            size={16}
                            className="cursor-pointer"
                            onClick={() => setSelectedConversation(null)}
                        />
                    </div>
                </div>
            </div>

            {/* CHAT MESSAGES */}
            <MessageContainer
                conversationId={String(selectedConversation._id)}
            />

            <TypingIndicator conversationId={String(selectedConversation._id)} />

            {/* INPUT */}
            <MessageInput />
        </div>
    );
};

export default RightPanel;