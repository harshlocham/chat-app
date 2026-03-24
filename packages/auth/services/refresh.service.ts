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
        .select("_id role status")
        .lean<{ _id: { toString(): string }; role?: "user" | "moderator" | "admin"; status?: string } | null>();

    if (!user) {
        throw new Error("User not found");
    }

    if (user.status && user.status !== "active") {
        throw new Error("Account is not active");
    }

    const nextRefreshToken = generateRefreshToken({
        sub: payload.sub,
        sessionId: payload.sessionId,
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
        type: "access",
    });

    return {
        accessToken,
        refreshToken: nextRefreshToken,
        userId: user._id.toString(),
        sessionId: payload.sessionId,
    };
};
