import { logAuthEventBestEffort } from "./auth-audit.service";

export type SecurityEventType =
    | "step_up_triggered"
    | "step_up_success"
    | "step_up_failed";

type SecurityEventInput = {
    type: SecurityEventType;
    userId?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
};

function getOutcome(type: SecurityEventType): "success" | "failure" {
    if (type === "step_up_failed") {
        return "failure";
    }

    return "success";
}

export async function logSecurityEvent({
    type,
    userId,
    ip,
    userAgent,
    metadata,
}: SecurityEventInput): Promise<void> {
    try {
        await logAuthEventBestEffort({
            eventType: type,
            outcome: getOutcome(type),
            userId,
            ipAddress: ip,
            userAgent,
            metadata,
        });
    } catch (error) {
        // Safety net: never let logging failure break authentication flow.
        console.error("[security-event] failed to log event", {
            type,
            userId,
            ip,
            error,
        });
    }
}
