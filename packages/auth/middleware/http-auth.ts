import { verifyAccessToken } from "../tokens/verify";

export type HttpAuthContext = {
    userId: string;
    role?: "user" | "moderator" | "admin";
};

export function authenticateHttpBearer(authorizationHeader?: string): HttpAuthContext {
    if (!authorizationHeader) {
        throw new Error("Missing authorization header");
    }

    const [scheme, token] = authorizationHeader.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
        throw new Error("Invalid authorization header format");
    }

    const payload = verifyAccessToken(token);
    return {
        userId: payload.sub,
        role: payload.role,
    };
}
