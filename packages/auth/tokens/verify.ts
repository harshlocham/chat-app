import jwt from "jsonwebtoken";
import { authConfig } from "../config";
import { AccessTokenPayload, RefreshTokenPayload } from "./types";

export function verifyAccessToken(token: string): AccessTokenPayload {
    const payload = jwt.verify(token, authConfig.accessToken.secret) as AccessTokenPayload;
    if (payload.type !== "access") {
        throw new Error("Invalid token type");
    }

    return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
    const payload = jwt.verify(token, authConfig.refreshToken.secret) as RefreshTokenPayload;
    if (payload.type !== "refresh") {
        throw new Error("Invalid token type");
    }

    return payload;
}