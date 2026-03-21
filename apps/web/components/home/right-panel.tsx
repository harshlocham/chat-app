"use client";

import MessageInput from "../chat/message-input";
import MessageList from "../chat/message-list";
import ChatPlaceHolder from "@/components/home/chat-placeholder";
import useChatStore from "@/store/chat-store";
import { useSession } from "next-auth/react";
import { ClientUser } from "@chat/types";
import { getAvatarUrl } from "@/lib/utils/imagekit";
import TypingIndicator from "./typing-indicator";
import ChatHeader from "../chat/chat-header";

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
        return (
            <div className="hidden min-h-0 flex-1 p-2 sm:p-3 lg:flex">
                <ChatPlaceHolder />
            </div>
        );
    }

    // safely derive other user
    const otherUser = selectedConversation.participants.find(
        (p) =>
            isUser(p) && p.email !== currentUserEmail
    );

    const conversationName = selectedConversation.isGroup
        ? selectedConversation.groupName || "Unnamed Group"
        : otherUser?.username || "Unknown";

    const rawAvatarSrc = selectedConversation.isGroup
        ? selectedConversation.image
        : otherUser?.profilePicture || selectedConversation.image;
    const avatarSrc = rawAvatarSrc ? getAvatarUrl(rawAvatarSrc, 128) : undefined;
    const avatarFallbackInitial =
        conversationName?.trim().charAt(0).toUpperCase() || "U";

    const conversationId = String(selectedConversation._id);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <ChatHeader
                conversationName={conversationName}
                avatarSrc={avatarSrc}
                avatarFallbackInitial={avatarFallbackInitial}
                isGroup={selectedConversation.isGroup}
                onBack={() => setSelectedConversation(null)}
                onClearSelection={() => setSelectedConversation(null)}
            />

            <MessageList
                conversationId={conversationId}
            />

            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] pb-[env(safe-area-inset-bottom)] lg:static lg:z-auto lg:border-t-0 lg:bg-transparent lg:pb-0">
                <TypingIndicator conversationId={conversationId} />
                <MessageInput />
            </div>
        </div>
    );
};

export default RightPanel;