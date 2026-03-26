// context/UserContext.tsx
"use client";

import { ClientUser } from "@chat/types";
import { createContext, useContext, useMemo } from "react";
import useSWR from "swr";
import {
    isStepUpResponse,
    parseAuthPayload,
    redirectToStepUpChallenge,
    refreshSession,
} from "@/lib/utils/auth/client-session";

type MeErrorPayload = {
    error?: string;
    code?: string;
    requiresReauth?: boolean;
    challengeId?: string;
};

const fetcher = async (url: string, hasRetried = false): Promise<ClientUser | null> => {
    const res = await fetch(url, { cache: "no-store" });
    const rawText = await res.text();
    const payload = parseAuthPayload(rawText) as MeErrorPayload | ClientUser | null;

    if (!res.ok) {
        const errorPayload = payload as MeErrorPayload | null;

        if (isStepUpResponse(errorPayload)) {
            redirectToStepUpChallenge(errorPayload?.challengeId);
            return null;
        }

        if (res.status === 401) {
            if (!hasRetried) {
                const refreshed = await refreshSession();
                if (refreshed.ok) {
                    return fetcher(url, true);
                }
            }

            return null;
        }

        throw new Error(errorPayload?.error || "Unable to load current user");
    }

    return (payload as ClientUser) || null;
};

type UserContextType = {
    user: ClientUser | null;
    isLofading: boolean;
    usersById: Record<string, ClientUser>;
    error: Error | null;
    refreshUser: () => Promise<ClientUser | null | undefined>;
};

const UserContext = createContext<UserContextType>({
    user: null,
    usersById: {},
    isLoading: true,
    error: null,
    refreshUser: async () => null,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
    const { data, error, isLoading, mutate } = useSWR<ClientUser | null>("/api/me", fetcher, {
        dedupingInterval: 60 * 1000,
        revalidateOnFocus: false,
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
        <UserContext.Provider
            value={{
                user: data ?? null,
                usersById,
                isLoading,
                error,
                refreshUser: () => mutate(),
            }}
        >
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    return useContext(UserContext);
}