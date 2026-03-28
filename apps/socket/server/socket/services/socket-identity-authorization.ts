import { createInternalRequestHeaders } from "@chat/types/utils/internal-bridge-auth";

type SocketIdentityAuthorizationResponse = {
    allowed: boolean;
    role?: "user" | "moderator" | "admin";
    reason?: string;
};

type AuthorizeSocketIdentityInput = {
    userId: string;
    tokenVersion?: number;
};

function getInternalWebServerUrl(): string {
    return (
        process.env.WEB_SERVER_URL?.trim() ||
        process.env.ORIGIN?.trim() ||
        "http://localhost:3000"
    );
}

export async function authorizeSocketIdentity(
    payload: AuthorizeSocketIdentityInput
): Promise<SocketIdentityAuthorizationResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    try {
        const response = await fetch(
            `${getInternalWebServerUrl()}/api/internal/socket/authorize-identity`,
            {
                method: "POST",
                headers: createInternalRequestHeaders(),
                body: JSON.stringify(payload),
                signal: controller.signal,
            }
        );

        if (!response.ok) {
            return { allowed: false, reason: "authorization_service_unavailable" };
        }

        const data = (await response.json()) as SocketIdentityAuthorizationResponse;
        return {
            allowed: Boolean(data?.allowed),
            role: data?.role,
            reason: data?.reason,
        };
    } catch {
        return { allowed: false, reason: "authorization_service_error" };
    } finally {
        clearTimeout(timeout);
    }
}
