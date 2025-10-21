'use client'
import { ListFilter, LogOut, Search } from "lucide-react";
import { Input } from "../ui/input";
import ThemeSwitch from "./theme-switch";
import Conversation from "./conversation";
//import { conversations } from "@/dummy-data/db";
import { signOut } from "next-auth/react";
import { IConversation, IConversationPopulated } from "@/models/Conversation";
import UserListDialog from "./dialogs/user-list-dialog";
import { getConversations } from "@/lib/api";
import { useEffect, useState } from "react";
import UserProfile from "./userProfile";

const LeftPanel = () => {

    const [conversations, setConversations] = useState<IConversation[]>([]);

    useEffect(() => {
        getConversations().then(setConversations);
    }, []);
    //const conversations: IConversation[] = [];
    // Example conversation, replace with actual data fetching logic
    return (
        <div className='w-1/4 border-gray-600 border-r min-w-[200px]'>
            <div className='sticky top-0 bg-left-panel z-10'>
                {/* Header */}
                <div className='flex justify-between bg-gray-primary p-3 items-center'>
                    {/* <User size={24} /> */}
                    <UserProfile />
                    <div className='flex items-center gap-3'>
                        <UserListDialog />
                        <ThemeSwitch />
                        <LogOut size={20} className='cursor-pointer' onClick={() => signOut({ callbackUrl: "/login" })} />
                    </div>
                </div>
                <div className='p-3 flex items-center'>
                    {/* Search */}
                    <div className='relative h-10 mx-3 flex-1'>
                        <Search
                            className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 z-10'
                            size={18}
                        />
                        <Input
                            type='text'
                            placeholder='Search or start a new chat'
                            className='pl-10 py-2 text-sm w-full rounded shadow-sm bg-gray-primary focus-visible:ring-transparent'
                        />
                    </div>
                    <ListFilter className='cursor-pointer' />
                </div>
            </div >

            {/* Chat List */}
            < div className='my-3 flex flex-col gap-0 max-h-[80%] overflow-auto' >
                {/* Conversations will go here*/}
                {
                    conversations.map((c) => (
                        <Conversation key={String(c._id)} conversation={c as IConversationPopulated} />
                    ))
                }

                {
                    conversations?.length === 0 && (
                        <>
                            <p className='text-center text-gray-500 text-sm mt-3'>No conversations yet</p>
                            <p className='text-center text-gray-500 text-sm mt-3 '>
                                We understand {"you're"} an introvert, but {"you've"} got to start somewhere 😊
                            </p>
                        </>
                    )
                }
            </div >
        </div >
    );
};
export default LeftPanel;