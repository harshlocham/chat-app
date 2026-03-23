import { verifySession } from "../session/verify-session";
import { generateAccessToken, generateRefreshToken } from "../tokens/generate";
import { hashToken } from "../session/token-hash";
import { rotateSessionTokenHash } from "../repositories/session.repo";
import { User } from "@/models/User";

export const refreshService = async (refreshToken: string) => {
    const { payload } = await verifySession(refreshToken);

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

    // CRITICAL: Fetch user from database to preserve latest role
    // This ensures role downgrades take effect immediately on token refresh
    const user = await User.findById(payload.sub).select("role").lean();
    const userRole = user?.role || "user";

    const accessToken = generateAccessToken({
        sub: payload.sub,
        role: userRole,
        type: "access",
    });

    return {
        accessToken,
        refreshToken: nextRefreshToken,
    };
};
