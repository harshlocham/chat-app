import jwt from "jsonwebtoken";
import { getAccessTokenConfig, getRefreshTokenConfig } from "../config";
import { AccessTokenPayload, RefreshTokenPayload } from "./types";

const VALID_ROLES = new Set(["user", "moderator", "admin"]);

export function verifyAccessToken(token: string): AccessTokenPayload {
    const config = getAccessTokenConfig();
    const payload = jwt.verify(token, config.secret, {
        algorithms: ["HS256"],
    }) as Partial<AccessTokenPayload>;

    if (
        !payload ||
        payload.type !== "access" ||
        typeof payload.sub !== "string" ||
        typeof payload.tokenVersion !== "number" ||
        !Number.isInteger(payload.tokenVersion) ||
        payload.tokenVersion < 0
    ) {
        throw new Error("Invalid access token payload");
    }

    if (payload.role && !VALID_ROLES.has(payload.role)) {
        throw new Error("Invalid access token role");
    }

    return {
        sub: payload.sub,
        role: payload.role,
        tokenVersion: payload.tokenVersion,
        type: "access",
    };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
    const config = getRefreshTokenConfig();
    const payload = jwt.verify(token, config.secret, {
        algorithms: ["HS256"],
    }) as Partial<RefreshTokenPayload>;

    if (
        !payload ||
        payload.type !== "refresh" ||
        typeof payload.sub !== "string" ||
        typeof payload.sessionId !== "string" ||
        typeof payload.tokenVersion !== "number" ||
        !Number.isInteger(payload.tokenVersion) ||
        payload.tokenVersion < 0
    ) {
        throw new Error("Invalid refresh token payload");
    }

    return {
        sub: payload.sub,
        sessionId: payload.sessionId,
        tokenVersion: payload.tokenVersion,
        type: "refresh",
    };
}