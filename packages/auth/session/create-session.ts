import { generateRefreshToken } from "../tokens/generate";
import { createSession } from "../repositories/session.repo";
import { hashToken } from "./token-hash";
import { Types } from "mongoose";

export const createUserSession = async ({
    userId,
    userAgent,
    ipAddress,
    tokenVersion,
}: {
    userId: string;
    userAgent?: string;
    ipAddress?: string;
    tokenVersion?: number;
}) => {
    const sessionId = new Types.ObjectId().toString();
    const refreshToken = generateRefreshToken({
        sub: userId,
        sessionId,
        tokenVersion: tokenVersion || 0,
        type: "refresh",
    });

    const session = await createSession({
        sessionId,
        userId,
        refreshTokenHash: hashToken(refreshToken),
        userAgent,
        ipAddress,
    });

    return { refreshToken, session };
};