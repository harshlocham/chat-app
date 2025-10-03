// context/UserContext.tsx
"use client";

import { IUser } from "@/models/User";
import Error from "next/error";
import { createContext, useContext } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());



type UserContextType = {
    user: IUser | null;
    isLoading: boolean;
    error: Error | null;
};

const UserContext = createContext<UserContextType>({
    user: null,
    isLoading: true,
    error: null,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
    const { data, error, isLoading } = useSWR<IUser>("/api/me", fetcher, {
        dedupingInterval: 60 * 1000,   // avoid duplicate calls
        revalidateOnFocus: false,      // don’t refetch when switching tabs
    });

    return (
        <UserContext.Provider value={{ user: data ?? null, isLoading, error }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    return useContext(UserContext);
}