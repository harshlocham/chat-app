import { timingSafeEqual } from "node:crypto";

export const INTERNAL_SECRET_HEADER = "x-internal-secret";

export function getInternalSecret(): string {
    const secret = process.env.INTERNAL_SECRET?.trim();

    if (!secret) {
        throw new Error("INTERNAL_SECRET is not configured");
    }

    return secret;
}

export function createInternalRequestHeaders(init?: HeadersInit): Headers {
    const headers = new Headers(init);
    headers.set("Content-Type", "application/json");
    headers.set(INTERNAL_SECRET_HEADER, getInternalSecret());
    return headers;
}

export function hasValidInternalSecret(
    providedSecret: string | null | undefined,
    expectedSecret = getInternalSecret()
): boolean {
    if (!providedSecret) {
        return false;
    }

    const provided = Buffer.from(providedSecret);
    const expected = Buffer.from(expectedSecret);

    if (provided.length !== expected.length) {
        return false;
    }

    return timingSafeEqual(provided, expected);
}