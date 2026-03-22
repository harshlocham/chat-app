import jwt from "jsonwebtoken";
import { authConfig } from "../config";
import { AccessTokenPayload, RefreshTokenPayload } from "./types";

export function generateAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, authConfig.accessToken.secret, {
        expiresIn: authConfig.accessToken.expiresIn,
    });
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
    return jwt.sign(payload, authConfig.refreshToken.secret, {
        expiresIn: authConfig.refreshToken.expiresIn,
    });
}