'use client';
import { formatDate } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { MessageSeenSvg } from "@/lib/svgs";
import { ImageIcon, Users, VideoIcon } from "lucide-react";
import { useConversationStore } from "@/store/chat-store";
import { IConversation } from "@/models/Conversation";
import { getMe } from "@/lib/api";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
const Conversation = ({ conversation }: { conversation: IConversation }) => {
    const conversationImage = conversation.groupImage || conversation.image;

    const lastMessage = conversation.lastMessage;
    const lastMessageType = lastMessage?.messageType;

    const { data: session } = useSession();
    const currentUserEmail = session?.user?.email;

    const otherUser = conversation.participants.find(
        (user) => user.email !== currentUserEmail
    );
    const conversationName = conversation.isGroup
        ? conversation.groupName
        : otherUser?.username || otherUser?.email?.split("@")[0] || "Unknown";


    const { setSelectedConversation, selectedConversation } = useConversationStore();
    const activeBgClass = selectedConversation?._id === conversation._id;
    const [me, setMe] = useState<any>(null);

    useEffect(() => {
        getMe().then(setMe);
    }, []);
    return (
        <>
            <div
                className={`flex gap-2 items-center p-3 hover:bg-chat-hover cursor-pointer
					${activeBgClass ? "bg-[hsl(var(--gray-tertiary))]" : ""}
				`}
                onClick={() => setSelectedConversation(conversation)}
            >
                <Avatar className='border border-gray-900 overflow-visible relative'>
                    {conversation.isOnline && (
                        <div className='absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-foreground' />
                    )}
                    <AvatarImage src={conversationImage || "/placeholder.png"} className='object-cover rounded-full' />
                    <AvatarFallback>
                        <div className='animate-pulse bg-gray-tertiary w-full h-full rounded-full'></div>
                    </AvatarFallback>
                </Avatar>
                <div className='w-full'>
                    <div className='flex items-center'>
                        <h3 className='text-sm font-medium'>{conversationName}</h3>
                        <span className='text-xs text-gray-500 ml-auto'>
                            {formatDate(
                                (lastMessage?._creationTime instanceof Date
                                    ? lastMessage._creationTime.getTime()
                                    : lastMessage?._creationTime) ||
                                (conversation._creationTime instanceof Date
                                    ? conversation._creationTime.getTime()
                                    : conversation._creationTime) ||
                                Date.now()
                            )}
                        </span>
                    </div>
                    <p className='text-[12px] mt-1 text-gray-500 flex items-center gap-1 '>
                        {lastMessage?.sender === me?._id ? <MessageSeenSvg /> : ""}
                        {conversation.isGroup && <Users size={16} />}
                        {!lastMessage && "Say Hi!"}
                        {lastMessageType === "text" ? (
                            lastMessage?.content ? (
                                lastMessage.content.length > 30 ? (
                                    <span>{lastMessage.content.slice(0, 30)}...</span>
                                ) : (
                                    <span>{lastMessage.content}</span>
                                )
                            ) : null
                        ) : null}
                        {lastMessageType === "image" && <ImageIcon size={16} />}
                        {lastMessageType === "video" && <VideoIcon size={16} />}
                    </p>
                </div>
            </div>
            <hr className='h-[1px] mx-10 bg-gray-primary' />
        </>
    );
};
export default Conversation;