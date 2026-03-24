type FingerprintInput = {
    userAgent?: string;
    ipAddress?: string;
};

export type FingerprintEvaluation = {
    valid: boolean;
    userAgentMismatch: boolean;
    ipBucketMismatch: boolean;
    requiresStepUp: boolean;
    reasons: Array<"user_agent_mismatch" | "ip_bucket_mismatch">;
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
}): FingerprintEvaluation {
    const storedUa = normalizeUserAgent(stored.userAgent);
    const incomingUa = normalizeUserAgent(incoming.userAgent);
    const userAgentMismatch = Boolean(storedUa && incomingUa && storedUa !== incomingUa);

    const storedIpBucket = normalizeIpBucket(stored.ipAddress);
    const incomingIpBucket = normalizeIpBucket(incoming.ipAddress);
    const ipBucketMismatch = Boolean(
        storedIpBucket && incomingIpBucket && storedIpBucket !== incomingIpBucket
    );

    const reasons: Array<"user_agent_mismatch" | "ip_bucket_mismatch"> = [];
    if (userAgentMismatch) {
        reasons.push("user_agent_mismatch");
    }
    if (ipBucketMismatch) {
        reasons.push("ip_bucket_mismatch");
    }

    const requiresStepUp = reasons.length > 0;

    return {
        valid: !requiresStepUp,
        userAgentMismatch,
        ipBucketMismatch,
        requiresStepUp,
        reasons,
    };
}
