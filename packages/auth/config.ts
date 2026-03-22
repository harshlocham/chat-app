function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not configured`);
    }

    return value;
}

export const authConfig = {
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