import { verifySession } from "../session/verify-session";
import { generateAccessToken, generateRefreshToken } from "../tokens/generate";
import { hashToken } from "../session/token-hash";
import { rotateSessionTokenHash } from "../repositories/session.repo";

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

    const accessToken = generateAccessToken({
        sub: payload.sub,
        type: "access",
    });

    return {
        accessToken,
        refreshToken: nextRefreshToken,
    };
};
