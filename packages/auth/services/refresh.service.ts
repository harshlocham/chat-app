import { verifySession } from "../session/verify-session";
import { generateAccessToken, generateRefreshToken } from "../tokens/generate";
import { hashToken } from "../session/token-hash";
import { revokeSession, rotateSessionTokenHash } from "../repositories/session.repo";
import { validateSessionFingerprint } from "../session/fingerprint";
import { AuthStepUpRequiredError } from "../errors/auth-errors";
import { User } from "@/models/User";

export const refreshService = async ({
    refreshToken,
    userAgent,
    ipAddress,
}: {
    refreshToken: string;
    userAgent?: string;
    ipAddress?: string;
}) => {
    const { payload, session } = await verifySession(refreshToken);

    const fingerprint = validateSessionFingerprint({
        stored: {
            userAgent: session.userAgent,
            ipAddress: session.ipAddress,
        },
        incoming: {
            userAgent,
            ipAddress,
        },
    });

    if (fingerprint.requiresStepUp) {
        await revokeSession(payload.sessionId);
        throw new AuthStepUpRequiredError(fingerprint.reasons);
    }

    const user = await User.findById(payload.sub)
        .select("_id role status tokenVersion")
        .lean<{ _id: { toString(): string }; role?: "user" | "moderator" | "admin"; status?: string; tokenVersion?: number } | null>();

    if (!user) {
        throw new Error("User not found");
    }

    if (user.status && user.status !== "active") {
        throw new Error("Account is not active");
    }

    const currentTokenVersion = user.tokenVersion || 0;
    if (payload.tokenVersion !== currentTokenVersion) {
        await revokeSession(payload.sessionId);
        throw new Error("Token version revoked");
    }

    const nextRefreshToken = generateRefreshToken({
        sub: payload.sub,
        sessionId: payload.sessionId,
        tokenVersion: currentTokenVersion,
        type: "refresh",
    });

    const rotated = await rotateSessionTokenHash(
        payload.sessionId,
        hashToken(nextRefreshToken)
    );

    if (!rotated) {
        throw new Error("Unable to rotate refresh session");
    }

    const accessToken = generateAccessToken({
        sub: user._id.toString(),
        role: user.role || "user",
        tokenVersion: currentTokenVersion,
        type: "access",
    });

    return {
        accessToken,
        refreshToken: nextRefreshToken,
        userId: user._id.toString(),
        sessionId: payload.sessionId,
    };
};
