function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not configured`);
    }

    return value;
}

export function getAccessTokenConfig() {
    return {
        secret: requiredEnv("ACCESS_TOKEN_SECRET"),
        expiresIn: "15m",
    } as const;
}

export function getRefreshTokenConfig() {
    return {
        secret: requiredEnv("REFRESH_TOKEN_SECRET"),
        expiresIn: "7d",
    } as const;
}

export function getSessionConfig() {
    return {
        refreshTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    } as const;
}

export function getCookieConfig() {
    return {
        accessToken: "accessToken",
        refreshToken: "refreshToken",
    } as const;
}

export function getAuthConfig() {
    return {
        accessToken: getAccessTokenConfig(),
        refreshToken: getRefreshTokenConfig(),
        session: getSessionConfig(),
        cookie: getCookieConfig(),
    } as const;
}

/**
 * Lazy-loaded auth config. Modules that need auth config should call getAuthConfig().
 * This allows services that don't need JWT (e.g., OTP) to be imported without env validation.
 */
export const authConfig = {
    get accessToken() {
        return getAccessTokenConfig();
    },
    get refreshToken() {
        return getRefreshTokenConfig();
    },
    get session() {
        return getSessionConfig();
    },
    get cookie() {
        return getCookieConfig();
    },
} as const;