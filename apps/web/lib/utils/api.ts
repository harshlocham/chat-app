import type { ClientConversation, ClientUser, UIMessage } from "@chat/types";

type ApiErrorPayload = {
    error?: string;
    code?: string;
    requiresReauth?: boolean;
    challengeId?: string;
};

let refreshInFlight: Promise<boolean> | null = null;

function redirectToStepUpChallenge(challengeId?: string) {
    if (typeof window === "undefined") {
        return;
    }

    if (window.location.pathname.startsWith("/auth/challenge")) {
        return;
    }

    const next = `${window.location.pathname}${window.location.search}`;
    const params = new URLSearchParams();
    if (challengeId) {
        params.set("cid", challengeId);
    }
    params.set("next", next || "/");

    window.location.href = `/auth/challenge?${params.toString()}`;
}

function redirectToLogin() {
    if (typeof window === "undefined") {
        return;
    }

    if (window.location.pathname === "/login") {
        return;
    }

    window.location.href = "/login";
}

function parsePayload(rawText: string): ApiErrorPayload | null {
    if (!rawText) {
        return null;
    }

    try {
        return JSON.parse(rawText) as ApiErrorPayload;
    } catch {
        return null;
    }
}

function isStepUpResponse(payload: ApiErrorPayload | null): boolean {
    return (
        payload?.code === "AUTH_STEP_UP_REQUIRED" ||
        payload?.requiresReauth === true ||
        payload?.error === "STEP_UP_REQUIRED"
    );
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
                const payload = parsePayload(rawText);

                if (response.ok) {
                    return true;
                }

                if (isStepUpResponse(payload)) {
                    redirectToStepUpChallenge(payload?.challengeId);
                    return false;
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

async function request<T>(url: string, init?: RequestInit, hasRetried = false): Promise<T> {
    const response = await fetch(url, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers || {}),
        },
    });

    const rawText = await response.text();
    const payload = parsePayload(rawText);

    if (!response.ok) {
        if (isStepUpResponse(payload)) {
            redirectToStepUpChallenge(payload?.challengeId);
        }

        if (response.status === 401 && !hasRetried && url !== "/api/auth/refresh") {
            const refreshed = await refreshSession();

            if (refreshed) {
                return request<T>(url, init, true);
            }

            redirectToLogin();
        }

        throw new Error(payload?.error || rawText || `Request failed with status ${response.status}`);
    }

    if (response.status === 204 || !rawText) {
        return undefined as T;
    }

    return JSON.parse(rawText) as T;
}

export async function getMe(): Promise<ClientUser> {
    return request<ClientUser>("/api/me");
}

export async function getUsers(): Promise<ClientUser[]> {
    return request<ClientUser[]>("/api/users");
}

export async function getConversations(): Promise<ClientConversation[]> {
    return request<ClientConversation[]>("/api/conversations");
}

export async function createConversation(payload: {
    participants: string[];
    isGroup: boolean;
    admin?: string;
    groupName?: string;
    image?: string;
}): Promise<string> {
    const data = await request<{ _id?: string; id?: string } | string>("/api/conversations", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    if (typeof data === "string") return data;
    return String(data._id || data.id || "");
}

export async function toggleBan(id: string, status: "active" | "banned") {
    return request<{ success: boolean }>("/api/admin/toggleban", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
    });
}

export async function changePermission(id: string, role: "user" | "moderator" | "admin") {
    return request<{ userrole: string }>("/api/admin/changeRoal", {
        method: "PATCH",
        body: JSON.stringify({ id, role }),
    });
}

export async function deleteMessage(messageId: string) {
    return request<{ success: boolean }>(`/api/messages/${messageId}/delete`, {
        method: "DELETE",
    });
}

export async function reactToMessage(message: UIMessage, emoji: string) {
    const id = typeof message._id === "string" ? message._id : String(message._id);
    return request<{ success: boolean }>(`/api/messages/${id}/react`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
    });
}
