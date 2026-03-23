import { verifySession } from "../session/verify-session";
import { generateAccessToken, generateRefreshToken } from "../tokens/generate";
import { hashToken } from "../session/token-hash";
import { rotateSessionTokenHash } from "../repositories/session.repo";
import { User } from "@/models/User";

export const refreshService = async (refreshToken: string) => {
    const { payload } = await verifySession(refreshToken);

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
    };
};
