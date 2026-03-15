"use client";

import { useEffect, useMemo, useState } from "react";
import { ListFilter, LogOut, Search } from "lucide-react";
import { signOut } from "next-auth/react";
import { Input } from "../ui/input";
import ThemeSwitch from "./theme-switch";
import UserListDialog from "./dialogs/user-list-dialog";
import UserProfile from "./userProfile";
import { getConversations } from "@/lib/utils/api";
import useChatStore from "@/store/chat-store";
import { ClientUser } from "@/shared/types/user";
import VirtualConversationList from "../sidebar/VirtualConversationList";
import { socket } from "@/lib/socket/socketClient";

// type guard
function isUser(p: unknown): p is ClientUser {
    return typeof p === "object" && p !== null && "username" in p;
}

const LeftPanel = () => {
    const conversations = useChatStore((s) => s.conversations);
    const setConversations = useChatStore((s) => s.setConversations);
    const setSelectedConversation = useChatStore((s) => s.setSelectedConversation);

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

    // fetch conversations
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

    // filter + sort conversations
    const filteredConversations = useMemo(() => {
        const term = debouncedSearch.toLowerCase();

        const filtered = conversations.filter((c) => {
            if (!term) return true;

            // group name search
            if (c.isGroup && c.groupName?.toLowerCase().includes(term)) {
                return true;
            }

            // participant username search
            if (
                c.participants?.some(
                    (p) => isUser(p) && p.username.toLowerCase().includes(term)
                )
            ) {
                return true;
            }

            // last message search
            if (c.lastMessage?.content?.toLowerCase().includes(term)) {
                return true;
            }

            return false;
        });

        // sort by latest activity
        return filtered.sort(
            (a, b) =>
                new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() -
                new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
        );
    }, [conversations, debouncedSearch]);

    // enter key search → open conversation
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
        <aside className="bg-[hsl(var(--left-panel))] w-[320px] min-w-[280px] max-w-[360px] h-full flex flex-col border-r border-[hsl(var(--border))] shadow-lg text-[hsl(var(--foreground))]">

            {/* Header */}
            <div className="p-4 flex items-center gap-2 border-b border-[hsl(var(--border))]">
                <UserProfile />

                <div className="ml-auto flex items-center gap-3">
                    <UserListDialog />
                    <ThemeSwitch />

                    <LogOut
                        size={20}
                        className="cursor-pointer text-gray-400 hover:text-white transition"
                        onClick={() => {
                            if (socket.connected) {
                                socket.disconnect();
                            }
                            void signOut({ callbackUrl: "/login" });
                        }}
                    />
                </div>
            </div>

            {/* Search */}
            <div className="p-3 flex items-center border-b border-[hsl(var(--border))] bg-[hsl(var(--left-panel))]">
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
                        className="pl-10 py-2 text-sm w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--foreground))] focus-visible:ring-2 focus-visible:ring-blue-500 transition"
                    />
                </div>

                <ListFilter className="cursor-pointer text-gray-500 hover:text-gray-300" />
            </div>

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto px-1 pb-4 custom-scrollbar">

                {/* Loading skeleton */}
                {loading && (
                    <div className="space-y-3 p-3">
                        {[...Array(6)].map((_, i) => (
                            <div
                                key={i}
                                className="h-12 bg-[hsl(var(--gray-secondary))] animate-pulse rounded-lg"
                            />
                        ))}
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <p className="text-center text-red-400 text-sm mt-6">
                        {error}
                    </p>
                )}

                {/* Empty state */}
                {!loading && !error && filteredConversations.length === 0 && (
                    <div className="text-center text-gray-500 text-sm mt-6">
                        No conversations found
                    </div>
                )}

                {/* Conversation list */}
                <div className="flex-1 overflow-hidden">
                    {!loading && !error && (
                        <VirtualConversationList />
                    )}
                </div>
            </div>
        </aside>
    );
};

export default LeftPanel;