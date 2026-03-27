import type { ClientConversation, ClientUser, UIMessage } from "@chat/types";
import {
    isStepUpResponse,
    parseAuthPayload,
    redirectToLogin,
    redirectToStepUpChallenge,
    refreshSession,
} from "@/lib/utils/auth/client-session";

type ApiErrorPayload = {
    error?: string;
    code?: string;
    requiresReauth?: boolean;
    challengeId?: string;
};

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(url: string, init?: RequestInit, hasRetried = false): Promise<T> {
    const response = await fetch(url, {
        ...init,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers || {}),
        },
    });

    const rawText = await response.text();
    const payload = parseAuthPayload(rawText) as ApiErrorPayload | null;

    if (!response.ok) {
        if (isStepUpResponse(payload)) {
            redirectToStepUpChallenge(payload?.challengeId);
        }

        if (response.status === 401 && !hasRetried && url !== "/api/auth/refresh") {
            const refreshed = await refreshSession();

            if (refreshed.ok) {
                return request<T>(url, init, true);
            }

            if (refreshed.ok === false && refreshed.reason === "transient") {
                await wait(250);
                const retriedRefresh = await refreshSession();
                if (retriedRefresh.ok) {
                    return request<T>(url, init, true);
                }

                if (retriedRefresh.ok === false && retriedRefresh.reason === "unauthorized") {
                    redirectToLogin();
                }
            }

            if (refreshed.ok === false && refreshed.reason === "unauthorized") {
                redirectToLogin();
            }
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
