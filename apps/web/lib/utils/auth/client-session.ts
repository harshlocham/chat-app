type AuthErrorPayload = {
    error?: string;
    code?: string;
    requiresReauth?: boolean;
    challengeId?: string;
};

declare global {
    interface Window {
        __authRefreshInFlight__?: Promise<RefreshSessionResult> | null;
    }
}

export function parseAuthPayload(rawText: string): AuthErrorPayload | null {
    if (!rawText) {
        return null;
    }

    try {
        return JSON.parse(rawText) as AuthErrorPayload;
    } catch {
        return null;
    }
}

export function isStepUpResponse(payload: AuthErrorPayload | null): boolean {
    return (
        payload?.code === "AUTH_STEP_UP_REQUIRED" ||
        payload?.requiresReauth === true ||
        payload?.error === "STEP_UP_REQUIRED"
    );
}

export function redirectToStepUpChallenge(challengeId?: string) {
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

    const next = `${window.location.pathname}${window.location.search}`;
    params.set("next", next || "/");

    window.location.href = `/auth/challenge?${params.toString()}`;
}

export function redirectToLogin() {
    if (typeof window === "undefined") {
        return;
    }

    if (window.location.pathname === "/login") {
        return;
    }

    window.location.href = "/login";
}

export type RefreshSessionResult =
    | { ok: true }
    | { ok: false; reason: "unauthorized" | "step_up" | "transient" };

function getRefreshPromise(): Promise<RefreshSessionResult> | null {
    if (typeof window === "undefined") {
        return null;
    }

    return window.__authRefreshInFlight__ ?? null;
}

function setRefreshPromise(promise: Promise<RefreshSessionResult> | null) {
    if (typeof window === "undefined") {
        return;
    }

    window.__authRefreshInFlight__ = promise;
}

export async function refreshSession(): Promise<RefreshSessionResult> {
    const existing = getRefreshPromise();
    if (existing) {
        return existing;
    }

    const inFlight = (async () => {
        try {
            const response = await fetch("/api/auth/refresh", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                cache: "no-store",
                credentials: "include",
            });

            const rawText = await response.text();
            const payload = parseAuthPayload(rawText);

            if (response.ok) {
                return { ok: true } as const;
            }

            if (isStepUpResponse(payload)) {
                redirectToStepUpChallenge(payload?.challengeId);
                return { ok: false, reason: "step_up" } as const;
            }

            if (response.status === 401) {
                return { ok: false, reason: "unauthorized" } as const;
            }

            return { ok: false, reason: "transient" } as const;
        } catch {
            return { ok: false, reason: "transient" } as const;
        } finally {
            setRefreshPromise(null);
        }
    })();

    setRefreshPromise(inFlight);
    return inFlight;
}
