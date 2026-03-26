// context/UserContext.tsx
"use client";

import { ClientUser } from "@chat/types";
import { createContext, useContext, useMemo } from "react";
import useSWR from "swr";

type MeErrorPayload = {
    error?: string;
    code?: string;
    requiresReauth?: boolean;
    challengeId?: string;
};

let refreshInFlight: Promise<boolean> | null = null;

function parsePayload(rawText: string): MeErrorPayload | ClientUser | null {
    if (!rawText) {
        return null;
    }

    try {
        return JSON.parse(rawText) as MeErrorPayload | ClientUser;
    } catch {
        return null;
    }
}

function redirectToStepUpChallenge(challengeId?: string) {
    if (typeof window === "undefined") {
        return;
    }

    if (window.location.pathname.startsWith("/auth/challenge")) {
        return;
    }

    const params = new URLSearchParams();
    if (challengeId) {
        params.set("cid", challengeId);
    }
    params.set("next", `${window.location.pathname}${window.location.search}` || "/");

    window.location.href = `/auth/challenge?${params.toString()}`;
}

async function refreshSession(): Promise<boolean> {
    if (!refreshInFlight) {
        refreshInFlight = (async () => {
            try {
                const response = await fetch("/api/auth/refresh", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    cache: "no-store",
                });

                const rawText = await response.text();
                const payload = parsePayload(rawText) as MeErrorPayload | null;

                if (response.ok) {
                    return true;
                }

                if (
                    payload?.code === "AUTH_STEP_UP_REQUIRED" ||
                    payload?.requiresReauth === true ||
                    payload?.error === "STEP_UP_REQUIRED"
                ) {
                    redirectToStepUpChallenge(payload.challengeId);
                }

                return false;
            } catch {
                return false;
            } finally {
                refreshInFlight = null;
            }
        })();
    }

    return refreshInFlight;
}

const fetcher = async (url: string, hasRetried = false): Promise<ClientUser | null> => {
    const res = await fetch(url, { cache: "no-store" });
    const rawText = await res.text();
    const payload = parsePayload(rawText);

    if (!res.ok) {
        const errorPayload = payload as MeErrorPayload | null;

        if (
            errorPayload?.code === "AUTH_STEP_UP_REQUIRED" ||
            errorPayload?.requiresReauth === true ||
            errorPayload?.error === "STEP_UP_REQUIRED"
        ) {
            redirectToStepUpChallenge(errorPayload?.challengeId);
            return null;
        }

        if (res.status === 401) {
            if (!hasRetried) {
                const refreshed = await refreshSession();
                if (refreshed) {
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
    isLoading: boolean;
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