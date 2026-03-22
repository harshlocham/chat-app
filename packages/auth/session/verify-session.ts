import { verifyRefreshToken } from "../tokens/verify";
import { findSessionByIdWithToken } from "../repositories/session.repo";
import { hashToken, tokenHashEquals } from "./token-hash";

export const verifySession = async (token: string) => {
    const payload = verifyRefreshToken(token);

    const session = await findSessionByIdWithToken(payload.sessionId);

    if (!session) throw new Error("Invalid session");

    if (session.revokedAt) {
        throw new Error("Session revoked");
    }

    if (session.expiresAt.getTime() <= Date.now()) {
        throw new Error("Session expired");
    }

    const incomingHash = hashToken(token);
    const storedHash = String(session.refreshTokenHash || "");
    if (!storedHash || !tokenHashEquals(storedHash, incomingHash)) {
        throw new Error("Invalid session token");
    }

    return { session, payload };
};