// context/UserContext.tsx
"use client";

import { ClientUser } from "@chat/types";
import Error from "next/error";
import { createContext, useContext, useMemo } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());



type UserContextType = {
    user: ClientUser | null;
    isLoading: boolean;
    usersById: Record<string, ClientUser>;
    error: Error | null;
};

const UserContext = createContext<UserContextType>({
    user: null,
    usersById: {},
    isLoading: true,
    error: null,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
    const { data, error, isLoading } = useSWR<ClientUser>("/api/me", fetcher, {
        dedupingInterval: 60 * 1000,   // avoid duplicate calls
        revalidateOnFocus: false,      // don’t refetch when switching tabs
    });
    const usersById = useMemo(() => {
        if (!data) return {};
        const id =
            typeof data._id === "string" ? data._id : String(data._id);
        return {
            [id]: data,
        }
    }, [data]);

    return (
        <UserContext.Provider value={{ user: data ?? null, usersById, isLoading, error }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    return useContext(UserContext);
}