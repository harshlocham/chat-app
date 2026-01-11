'use client';

import { useEffect, useMemo, useState } from "react";
import { ListFilter, LogOut, Search } from "lucide-react";
import { signOut } from "next-auth/react";
import { Input } from "../ui/input";
import ThemeSwitch from "./theme-switch";
import Conversation from "./conversation";
import UserListDialog from "./dialogs/user-list-dialog";
import UserProfile from "./userProfile";
import { getConversations } from "@/lib/utils/api";
import useChatStore from "@/store/chat-store";
import { IUser } from "@/models/User";

// type guard
function isUser(p: unknown): p is IUser {
    return typeof p === "object" && p !== null && "username" in p;
}

const LeftPanel = () => {
    const conversations = useChatStore((s) => s.conversations);
    const setConversations = useChatStore((s) => s.setConversations);
    const setSelectedConversation = useChatStore(
        (s) => s.setSelectedConversation
    );

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // debounce search
    useEffect(() => {
        const handler = setTimeout(
            () => setDebouncedSearch(search.trim()),
            300
        );
        return () => clearTimeout(handler);
    }, [search]);

    // fetch conversations once
    useEffect(() => {
        const fetchConversations = async () => {
            try {
                setLoading(true);
                const data = await getConversations();
                setConversations(data);
            } catch (err) {
                console.error(err);
                setError("Unable to load conversations");
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    }, [setConversations]);

    // filter conversations
    const filteredConversations = useMemo(() => {
        if (!debouncedSearch) return conversations;

        const term = debouncedSearch.toLowerCase();

        return conversations.filter((c) => {
            if (c.isGroup) {
                return c.groupName?.toLowerCase().includes(term);
            }

            return c.participants?.some(
                (p) => isUser(p) && p.username.toLowerCase().includes(term)
            );
        });
    }, [conversations, debouncedSearch]);

    // enter key handling
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter" || !debouncedSearch) return;

        const existingDM = conversations.find(
            (c) =>
                !c.isGroup &&
                c.participants?.some(
                    (p) =>
                        isUser(p) &&
                        p.username
                            .toLowerCase()
                            .includes(debouncedSearch.toLowerCase())
                )
        );

        if (existingDM) {
            setSelectedConversation(existingDM);
        }
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
                            onClick={() => signOut({ callbackUrl: "/login" })}
                        />
                    </div>
                </div>

                {/* Search */}
                <div className="p-3 flex items-center">
                    <div className="relative h-10 mx-3 flex-1">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                            size={18}
                        />
                        <Input
                            type="text"
                            placeholder="Search or start a new chat"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="pl-10 py-2 text-sm w-full rounded bg-gray-primary focus-visible:ring-transparent"
                        />
                    </div>
                    <ListFilter className="cursor-pointer text-gray-500 hover:text-gray-300" />
                </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto px-1 pb-4">
                {loading && (
                    <p className="text-center text-gray-400 text-sm mt-6">
                        Loading conversations...
                    </p>
                )}

                {error && (
                    <p className="text-center text-red-400 text-sm mt-6">
                        {error}
                    </p>
                )}

                {!loading && !error && filteredConversations.length === 0 && (
                    <div className="text-center text-gray-500 text-sm mt-6">
                        No conversations found
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