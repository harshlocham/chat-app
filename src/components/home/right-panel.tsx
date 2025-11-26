"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Video, X } from "lucide-react";
import MessageInput from "./message-input";
import MessageContainer from "./message-container";
import ChatPlaceHolder from "@/components/home/chat-placeholder";
import GroupMembersDialog from "./group-members-dialog";
import useChatStore from "@/store/chat-store";
import { useSession } from "next-auth/react";
//import { useConversationId } from "@/hooks/useConversationId";

const RightPanel = () => {
    const { data: session } = useSession();
    const currentUserEmail = session?.user?.email;
    const { selectedConversation, setSelectedConversation } = useChatStore()
    if (!selectedConversation) return <ChatPlaceHolder />;
    //console.log(selectedConversation)
    const otherUser = selectedConversation.participants.find(
        (user) => user.email !== currentUserEmail
    );
    const conversationName = selectedConversation.groupName || otherUser?.username || "Unknown";
    return (
        <div className='w-3/4 flex flex-col'>
            <div className='w-full sticky top-0 z-50'>
                {/* Header */}
                <div className='flex justify-between bg-gray-primary p-3'>
                    <div className='flex gap-3 items-center'>
                        <Avatar>
                            <AvatarImage src={selectedConversation.image || otherUser?.profilePicture || "/placeholder.png"} className='object-cover' />
                            <AvatarFallback>
                                <div className='animate-pulse bg-gray-tertiary w-full h-full rounded-full' />
                            </AvatarFallback>
                        </Avatar>
                        <div className='flex flex-col'>
                            <p>{conversationName}</p>
                            {selectedConversation.isGroup && <GroupMembersDialog />}
                        </div>
                    </div>

                    <div className='flex items-center gap-7 mr-5'>
                        <a href='/video-call' target='_blank'>
                            <Video size={23} />
                        </a>
                        <X size={16} className='cursor-pointer' onClick={() => setSelectedConversation(null)} />
                    </div>
                </div>
            </div>
            {/* CHAT MESSAGES */}
            <MessageContainer conversationId={String(selectedConversation._id)} />

            {/* INPUT */}
            <MessageInput onSend={() => { }} />
        </div>
    );
};
export default RightPanel;