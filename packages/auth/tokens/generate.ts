import jwt from "jsonwebtoken";
import { getAuthConfig } from "../config";
import { AccessTokenPayload, RefreshTokenPayload } from "./types";

export function generateAccessToken(payload: AccessTokenPayload): string {
    const config = getAuthConfig();
    return jwt.sign(payload, config.accessToken.secret, {
        expiresIn: config.accessToken.expiresIn,
        algorithm: "HS256",
    });
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
    const config = getAuthConfig();
    return jwt.sign(payload, config.refreshToken.secret, {
        expiresIn: config.refreshToken.expiresIn,
        algorithm: "HS256",
    });
}