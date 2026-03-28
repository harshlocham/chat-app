import { verifyRefreshToken } from "../tokens/verify";
import { findSessionByIdWithToken } from "../repositories/session.repo";
import { hashToken, tokenHashEquals } from "./token-hash";

type VerifySessionFailureReason =
    | "SESSION_NOT_FOUND"
    | "USER_MISMATCH"
    | "SESSION_REVOKED"
    | "SESSION_EXPIRED"
    | "TOKEN_MISMATCH";

function logVerifySessionFailure(
    reason: VerifySessionFailureReason,
    metadata: Record<string, unknown>
) {
    // Do not log raw tokens or token hashes.
    console.warn("[auth][verifySession][failure]", {
        reason,
        ...metadata,
    });
}

export const verifySession = async (token: string) => {
    const payload = verifyRefreshToken(token);

    const session = await findSessionByIdWithToken(payload.sessionId);

    if (!session) {
        logVerifySessionFailure("SESSION_NOT_FOUND", {
            sessionId: payload.sessionId,
            subjectUserId: payload.sub,
        });
        throw new Error("Invalid session");
    }

    if (String(session.userId) !== payload.sub) {
        logVerifySessionFailure("USER_MISMATCH", {
            sessionId: payload.sessionId,
            subjectUserId: payload.sub,
            sessionUserId: String(session.userId),
        });
        throw new Error("Invalid session user binding");
    }

    if (session.revokedAt) {
        logVerifySessionFailure("SESSION_REVOKED", {
            sessionId: payload.sessionId,
            subjectUserId: payload.sub,
            revokedAt: session.revokedAt.toISOString(),
        });
        throw new Error("Session revoked");
    }

    if (session.expiresAt.getTime() <= Date.now()) {
        logVerifySessionFailure("SESSION_EXPIRED", {
            sessionId: payload.sessionId,
            subjectUserId: payload.sub,
            expiresAt: session.expiresAt.toISOString(),
        });
        throw new Error("Session expired");
    }

    const incomingHash = hashToken(token);
    const storedHash = String(session.refreshTokenHash || "");
    if (!storedHash || !tokenHashEquals(storedHash, incomingHash)) {
        logVerifySessionFailure("TOKEN_MISMATCH", {
            sessionId: payload.sessionId,
            subjectUserId: payload.sub,
            hasStoredHash: Boolean(storedHash),
        });
        throw new Error("Invalid session token");
    }

    return { session, payload };
};