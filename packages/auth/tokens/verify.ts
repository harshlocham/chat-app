import jwt from 'jsonwebtoken';
import {authConfig} from '../config';
import {AccessTokenPayload,RefreshTokenPayload} from './types';

export function verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, authConfig.accessToken.secret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
    return jwt.verify(token, authConfig.refreshToken.secret) as RefreshTokenPayload;
}