import { verifyAccessToken } from "../tokens/verify";

export type SocketAuthContext = {
    userId: string;
    role?: "user" | "moderator" | "admin";
};

export function authenticateSocketToken(accessToken?: string): SocketAuthContext {
    if (!accessToken) {
        throw new Error("Missing socket access token");
    }

    const payload = verifyAccessToken(accessToken);
    return {
        userId: payload.sub,
        role: payload.role,
    };
}
