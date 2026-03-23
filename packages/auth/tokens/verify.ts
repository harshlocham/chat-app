import jwt from "jsonwebtoken";
import { getAuthConfig } from "../config";
import { AccessTokenPayload, RefreshTokenPayload } from "./types";

export function verifyAccessToken(token: string): AccessTokenPayload {
    const config = getAuthConfig();
    const payload = jwt.verify(token, config.accessToken.secret, {
        algorithms: ["HS256"],
    }) as AccessTokenPayload;
    if (payload.type !== "access") {
        throw new Error("Invalid token type");
    }

    return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
    const config = getAuthConfig();
    const payload = jwt.verify(token, config.refreshToken.secret, {
        algorithms: ["HS256"],
    }) as RefreshTokenPayload;
    if (payload.type !== "refresh") {
        throw new Error("Invalid token type");
    }

    return payload;
}