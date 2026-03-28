import jwt from "jsonwebtoken";
import { getAccessTokenConfig, getRefreshTokenConfig } from "../config";
import { AccessTokenPayload, RefreshTokenPayload } from "./types";

export function generateAccessToken(payload: AccessTokenPayload): string {
    const config = getAccessTokenConfig();
    return jwt.sign(payload, config.secret, {
        expiresIn: config.expiresIn,
        algorithm: "HS256",
    });
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
    const config = getRefreshTokenConfig();
    return jwt.sign(payload, config.secret, {
        expiresIn: config.expiresIn,
        algorithm: "HS256",
    });
}