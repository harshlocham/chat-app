import crypto from "crypto";

export function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export function tokenHashEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, "utf8");
    const rightBuffer = Buffer.from(right, "utf8");

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}