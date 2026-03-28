import { createHash } from "node:crypto";

type FingerprintInput = {
    deviceId?: string;
    userAgent?: string;
    ipAddress?: string;
};

export type FingerprintEvaluation = {
    valid: boolean;
    deviceMismatch: boolean;
    userAgentMismatch: boolean;
    ipBucketMismatch: boolean;
    requiresStepUp: boolean;
    reasons: Array<"device_mismatch" | "user_agent_mismatch" | "ip_bucket_mismatch">;
};

function normalizeDeviceId(deviceId?: string): string {
    return String(deviceId || "").trim().toLowerCase();
}

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
    const storedDevice = normalizeDeviceId(stored.deviceId);
    const incomingDevice = normalizeDeviceId(incoming.deviceId);
    const deviceMismatch = Boolean(storedDevice && incomingDevice && storedDevice !== incomingDevice);

    const storedUa = normalizeUserAgent(stored.userAgent);
    const incomingUa = normalizeUserAgent(incoming.userAgent);
    const userAgentMismatch = Boolean(storedUa && incomingUa && storedUa !== incomingUa);

    const storedIpBucket = normalizeIpBucket(stored.ipAddress);
    const incomingIpBucket = normalizeIpBucket(incoming.ipAddress);
    const ipBucketMismatch = Boolean(
        storedIpBucket && incomingIpBucket && storedIpBucket !== incomingIpBucket
    );

    const reasons: Array<"device_mismatch" | "user_agent_mismatch" | "ip_bucket_mismatch"> = [];
    if (deviceMismatch) {
        reasons.push("device_mismatch");
    }
    if (userAgentMismatch) {
        reasons.push("user_agent_mismatch");
    }
    if (ipBucketMismatch) {
        reasons.push("ip_bucket_mismatch");
    }

    const requiresStepUp = reasons.length > 0;

    return {
        valid: !requiresStepUp,
        deviceMismatch,
        userAgentMismatch,
        ipBucketMismatch,
        requiresStepUp,
        reasons,
    };
}

export function generateDeviceFingerprint({
    deviceId,
    userAgent,
    ipAddress,
}: {
    deviceId?: string;
    userAgent?: string;
    ipAddress?: string;
}): string {
    const normalizedDeviceId = normalizeDeviceId(deviceId);
    if (normalizedDeviceId) {
        return createHash("sha256")
            .update(`device:${normalizedDeviceId}`)
            .digest("hex");
    }

    const normalizedUa = normalizeUserAgent(userAgent) || "unknown_ua";
    const normalizedIpBucket = normalizeIpBucket(ipAddress) || "unknown_ip";

    return createHash("sha256")
        .update(`ua:${normalizedUa}|ip:${normalizedIpBucket}`)
        .digest("hex");
}
