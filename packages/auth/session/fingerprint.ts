type FingerprintInput = {
    userAgent?: string;
    ipAddress?: string;
};

function normalizeUserAgent(userAgent?: string): string {
    return String(userAgent || "").trim().toLowerCase();
}

function normalizeIpBucket(ipAddress?: string): string {
    const ip = String(ipAddress || "").trim().toLowerCase();
    if (!ip || ip === "unknown") {
        return "";
    }

    if (ip.includes(".")) {
        const parts = ip.split(".");
        if (parts.length === 4) {
            return parts.slice(0, 3).join(".");
        }
    }

    if (ip.includes(":")) {
        return ip.split(":").slice(0, 4).join(":");
    }

    return ip;
}

export function validateSessionFingerprint({
    stored,
    incoming,
}: {
    stored: FingerprintInput;
    incoming: FingerprintInput;
}): { valid: boolean; reason?: "user_agent_mismatch" | "ip_bucket_mismatch" } {
    const storedUa = normalizeUserAgent(stored.userAgent);
    const incomingUa = normalizeUserAgent(incoming.userAgent);
    if (storedUa && incomingUa && storedUa !== incomingUa) {
        return { valid: false, reason: "user_agent_mismatch" };
    }

    const storedIpBucket = normalizeIpBucket(stored.ipAddress);
    const incomingIpBucket = normalizeIpBucket(incoming.ipAddress);
    if (storedIpBucket && incomingIpBucket && storedIpBucket !== incomingIpBucket) {
        return { valid: false, reason: "ip_bucket_mismatch" };
    }

    return { valid: true };
}
