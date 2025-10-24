'use client';

import { useEffect, useMemo, useState } from 'react';
import { ListFilter, LogOut, Search } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { Input } from '../ui/input';
import ThemeSwitch from './theme-switch';
import Conversation from './conversation';
import UserListDialog from './dialogs/user-list-dialog';
import UserProfile from './userProfile';
import { getConversations } from '@/lib/api'; // 👈 must exist in your API
import { IConversationPopulated } from '@/models/Conversation';
import { useConversationStore } from "@/store/chat-store";

const LeftPanel = () => {
    const { setSelectedConversation } = useConversationStore();
    const [conversations, setConversations] = useState<IConversationPopulated[]>([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 🔸 Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(handler);
    }, [search]);

    // 🔸 Fetch all conversations (groups + DMs)
    useEffect(() => {
        const fetchConversations = async () => {
            try {
                setLoading(true);
                const data = await getConversations();
                setConversations(data);
            } catch (err) {
                console.error('Failed to fetch conversations:', err);
                setError('Unable to load conversations');
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    }, []);

    // 🔸 Filter conversations by participant/group name
    const filteredConversations = useMemo(() => {
        if (!debouncedSearch) return conversations;

        const term = debouncedSearch.toLowerCase();

        return conversations.filter((c) => {
            if (c.isGroup) {
                return c.name?.toLowerCase().includes(term);
            }
            return c.participants?.some((p) => p.username?.toLowerCase().includes(term));
        });
    }, [conversations, debouncedSearch]);

    // 🔸 Handle opening a conversation
    const handleSelectConversation = (conversation: IConversationPopulated) => {
        setSelectedConversation(conversation);
    };

    // 🔸 Handle pressing Enter
    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter' || !debouncedSearch) return;

        // 1️⃣ Try to find existing direct message (non-group)
        const matchingDM = conversations.find(
            (c) =>
                !c.isGroup &&
                c.participants?.some((p) =>
                    p.username?.toLowerCase().includes(debouncedSearch.toLowerCase())
                )
        );

        if (matchingDM) {
            handleSelectConversation((matchingDM as IConversationPopulated));
            return;
        }

        // // 2️⃣ If no DM found — create a new one (assuming backend route exists)
        // try {
        //   const newConversation = await createConversation({
        //     userName: debouncedSearch, // 👈 API should find that user by name or email
        //   });

        //   if (newConversation) {
        //     setConversations((prev) => [newConversation, ...prev]);
        //     handleSelectConversation(String(newConversation._id));
        //   }
        // } catch (err) {
        //   console.error('Failed to create conversation:', err);
        //   setError('User not found or could not start chat');
        // }
    };

    return (
        <div className="w-1/4 border-r border-gray-600 min-w-[250px] flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-left-panel z-10">
                <div className="flex justify-between bg-gray-primary p-3 items-center">
                    <UserProfile />
                    <div className="flex items-center gap-3">
                        <UserListDialog />
                        <ThemeSwitch />
                        <LogOut
                            size={20}
                            className="cursor-pointer text-gray-400 hover:text-white transition"
                            onClick={() => signOut({ callbackUrl: '/login' })}
                        />
                    </div>
                </div>

                {/* Search Bar */}
                <div className="p-3 flex items-center">
                    <div className="relative h-10 mx-3 flex-1">
                        <Search
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 z-10"
                            size={18}
                        />
                        <Input
                            type="text"
                            placeholder="Search or start a new chat"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="pl-10 py-2 text-sm w-full rounded shadow-sm bg-gray-primary focus-visible:ring-transparent"
                        />
                    </div>
                    <ListFilter className="cursor-pointer text-gray-500 hover:text-gray-300" />
                </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto px-1 pb-4">
                {loading && <p className="text-center text-gray-400 text-sm mt-6">Loading conversations...</p>}
                {error && <p className="text-center text-red-400 text-sm mt-6">{error}</p>}

                {!loading && !error && filteredConversations.length === 0 && (
                    <div className="text-center text-gray-500 text-sm mt-6">
                        <p>No conversations found</p>
                    </div>
                )}

                {!loading &&
                    !error &&
                    filteredConversations.map((c) => (
                        <Conversation
                            key={String(c._id)}
                            conversation={c}
                        />
                    ))}
            </div>
        </div>
    );
};

export default LeftPanel;