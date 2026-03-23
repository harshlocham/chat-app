function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not configured`);
    }

    return value;
}

export function getAuthConfig() {
    return {
        accessToken: {
            secret: requiredEnv("ACCESS_TOKEN_SECRET"),
            expiresIn: "15m",
        },
        refreshToken: {
            secret: requiredEnv("REFRESH_TOKEN_SECRET"),
            expiresIn: "7d",
        },
        session: {
            refreshTtlMs: 7 * 24 * 60 * 60 * 1000,
        },
        cookie: {
            accessToken: "accessToken",
            refreshToken: "refreshToken",
        },
    } as const;
}

/**
 * Lazy-loaded auth config. Modules that need auth config should call getAuthConfig().
 * This allows services that don't need JWT (e.g., OTP) to be imported without env validation.
 */
export const authConfig = {
    get accessToken() {
        return getAuthConfig().accessToken;
    },
    get refreshToken() {
        return getAuthConfig().refreshToken;
    },
    get session() {
        return getAuthConfig().session;
    },
    get cookie() {
        return getAuthConfig().cookie;
    },
} as const;