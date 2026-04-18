import { config as loadEnv } from "dotenv";
import Redis from "ioredis";
import mongoose from "mongoose";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TaskExecutionActionType, TaskExecutionUpdatedPayload, TaskResult, TaskUpdatedPayload } from "@chat/types";
import * as outboxModule from "../../packages/services/outbox.service";
import * as intelligenceModule from "../../packages/services/task-intelligence.service";
import * as taskModule from "../../packages/db/models/Task";
import { RetryManager } from "./services/retry-manager.js";
import AgentRunner from "./services/agent-runner.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const visitedEnvPaths = new Set<string>();
let scanDir = currentDir;

for (let depth = 0; depth < 8; depth += 1) {
    const envCandidates = [
        path.join(scanDir, ".env.local"),
        path.join(scanDir, ".env"),
    ];

    for (const envPath of envCandidates) {
        if (!visitedEnvPaths.has(envPath) && existsSync(envPath)) {
            loadEnv({ path: envPath });
            visitedEnvPaths.add(envPath);
        }
    }

    const parent = path.dirname(scanDir);
    if (parent === scanDir) {
        break;
    }
    scanDir = parent;
}

const WORKER_ID = `${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
const BATCH_SIZE = Number(process.env.TASK_WORKER_BATCH_SIZE || 10);
const POLL_INTERVAL_MS = Number(process.env.TASK_WORKER_POLL_MS || 800);

const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
const redis = redisUrl
    ? new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: null })
    : null;

const internalBaseUrl = process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
const INTERNAL_SECRET_HEADER = "x-internal-secret";
const retryManager = new RetryManager([1000, 2000, 5000]);
const agentRunner = new AgentRunner({ retryManager, internalBaseUrl });

const outboxApi = ((outboxModule as unknown as { default?: unknown }).default || outboxModule) as {
    claimOutboxEvents?: (workerId: string, limit?: number) => Promise<Array<{
        _id: { toString(): string };
        topic: string;
        dedupeKey: string;
        payload: Record<string, unknown>;
        attempts: number;
    }>>;
    markOutboxEventCompleted?: (id: string) => Promise<void>;
    markOutboxEventFailed?: (id: string, errorMessage: string, retryDelayMs?: number) => Promise<void>;
};

const processMessageTaskIntelligence = (
    (intelligenceModule as unknown as { default?: unknown }).default
    || intelligenceModule
) as {
    processMessageTaskIntelligence?: (input: {
        messageId: string;
        conversationId: string;
        senderId: string;
        content: string;
        messageType: string;
    }) => Promise<{
        semanticPayload: {
            conversationId: string;
        };
        taskCreatedPayload?: unknown;
        taskUpdatedPayload?: unknown;
        taskLinkedPayload?: unknown;
    } | null>;
};

type TaskModelLike = {
    findById: (id: string) => Promise<{
        _id: { toString(): string };
        version: number;
        status: string;
        retryCount?: number;
        maxRetries?: number;
        result?: TaskResult;
        updatedBy: null | string;
        save: () => Promise<void>;
    } | null>;
};

function resolveTaskModel(moduleNs: unknown): TaskModelLike {
    const asRecord = moduleNs as Record<string, unknown>;
    const candidates: unknown[] = [
        moduleNs,
        asRecord?.default,
        (asRecord?.default as Record<string, unknown> | undefined)?.default,
        asRecord?.TaskModel,
        (asRecord?.default as Record<string, unknown> | undefined)?.TaskModel,
    ];

    for (const candidate of candidates) {
        if (candidate && typeof (candidate as { findById?: unknown }).findById === "function") {
            return candidate as TaskModelLike;
        }
    }

    const topLevelKeys = Object.keys(asRecord || {});
    const defaultKeys = asRecord?.default && typeof asRecord.default === "object"
        ? Object.keys(asRecord.default as Record<string, unknown>)
        : [];

    throw new Error(
        `Task model exports are invalid. taskModule keys=${topLevelKeys.join(",")}; default keys=${defaultKeys.join(",")}`
    );
}

const TaskModel = resolveTaskModel(taskModule);

type MessageCreatedPayload = {
    messageId: string;
    conversationId: string;
    senderId: string;
    content: string;
    messageType: string;
};

type TaskExecutionRequestedPayload = {
    taskId: string;
    conversationId: string;
    triggerMessageId: string;
    requestedByType: "user" | "agent" | "system";
    requestedById: string | null;
    actionType: TaskExecutionActionType;
    parameters?: Record<string, unknown>;
    confidence?: number;
    needsApproval?: boolean;
};

type NormalizedTaskExecutionRequestedPayload = Omit<TaskExecutionRequestedPayload, "actionType"> & {
    actionType: TaskExecutionActionType;
};

type ActionExecutionResult = {
    summary: string;
    adapterSuccess: boolean;
    evidence: unknown;
    error?: string;
};

type VerificationOutcome = {
    success: boolean;
    confidence: number;
};

type ExecutionPhase = "plan" | "act" | "verify";

type ExecutionContext = {
    payload: NormalizedTaskExecutionRequestedPayload;
    currentTask: {
        status: string;
    } | null;
    executionPolicy: {
        retryCount: number;
        maxRetries: number;
    } | null;
    result: ActionExecutionResult | null;
    verification: VerificationOutcome | null;
};

type ExecutionStep = {
    name: string;
    phase: ExecutionPhase;
    retryable?: boolean;
    maxAttempts?: number;
    run: (context: ExecutionContext) => Promise<void>;
};

type ExecutionPlan = {
    steps: ExecutionStep[];
};

function wait(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function isMessageCreatedPayload(payload: Record<string, unknown>): payload is MessageCreatedPayload {
    return (
        typeof payload.messageId === "string"
        && typeof payload.conversationId === "string"
        && typeof payload.senderId === "string"
        && typeof payload.content === "string"
        && typeof payload.messageType === "string"
    );
}

function isTaskExecutionRequestedPayload(payload: Record<string, unknown>): payload is TaskExecutionRequestedPayload {
    return (
        typeof payload.taskId === "string"
        && typeof payload.conversationId === "string"
        && (typeof payload.triggerMessageId === "string" || typeof payload.triggerMessageId === "undefined")
        && (typeof payload.requestedByType === "string" || typeof payload.requestedByType === "undefined")
        && (typeof payload.actionType === "string" || typeof payload.actionType === "undefined")
    );
}

function normalizeTaskExecutionRequestedPayload(payload: Record<string, unknown>): NormalizedTaskExecutionRequestedPayload {
    const actionType = ["create_github_issue", "schedule_meeting", "send_email"].includes(String(payload.actionType))
        ? (payload.actionType as TaskExecutionActionType)
        : "none";

    return {
        taskId: String(payload.taskId),
        conversationId: String(payload.conversationId),
        triggerMessageId: typeof payload.triggerMessageId === "string"
            ? payload.triggerMessageId
            : String(payload.taskId),
        requestedByType: payload.requestedByType === "user" || payload.requestedByType === "agent" || payload.requestedByType === "system"
            ? payload.requestedByType
            : "agent",
        requestedById: typeof payload.requestedById === "string" ? payload.requestedById : null,
        actionType,
        parameters: payload.parameters && typeof payload.parameters === "object" ? (payload.parameters as Record<string, unknown>) : {},
        confidence: typeof payload.confidence === "number" ? payload.confidence : 0.5,
        needsApproval: typeof payload.needsApproval === "boolean"
            ? payload.needsApproval
            : actionType !== "none" && (typeof payload.confidence === "number" ? payload.confidence < 0.7 : true),
    };
}

async function emitInternal(path: string, conversationId: string, payload: unknown) {
    const internalSecret = process.env.INTERNAL_SECRET || "";
    await fetch(`${internalBaseUrl}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(internalSecret
                ? {
                    [INTERNAL_SECRET_HEADER]: internalSecret,
                }
                : {}),
        },
        body: JSON.stringify({
            conversationId,
            payload,
        }),
    });
}

function computeRetryDelay(attempts: number) {
    const base = 1000;
    const capped = Math.min(attempts, 8);
    return base * (2 ** capped);
}

function getOutboxFns() {
    const claim = outboxApi.claimOutboxEvents;
    const complete = outboxApi.markOutboxEventCompleted;
    const fail = outboxApi.markOutboxEventFailed;

    if (typeof claim !== "function" || typeof complete !== "function" || typeof fail !== "function") {
        throw new Error(`Outbox module exports are invalid. keys=${Object.keys(outboxModule).join(",")}`);
    }

    return { claim, complete, fail };
}

function getIntelligenceFn() {
    const fn = processMessageTaskIntelligence.processMessageTaskIntelligence;
    if (typeof fn !== "function") {
        throw new Error(`Task intelligence module exports are invalid. keys=${Object.keys(intelligenceModule).join(",")}`);
    }
    return fn;
}

async function emitTaskExecutionUpdate(payload: TaskExecutionUpdatedPayload) {
    await emitInternal("/internal/task-execution-updated", payload.conversationId, payload);
}

function clampConfidence(value: number) {
    return Math.max(0, Math.min(1, value));
}

async function updateTaskLifecycle(input: {
    taskId: string;
    conversationId: string;
    status: "pending" | "executing" | "completed" | "failed" | "partial";
    result?: TaskResult;
    retryCount?: number;
    maxRetries?: number;
}) {
    const { taskId, conversationId, status, result, retryCount, maxRetries } = input;
    const task = await TaskModel.findById(taskId);
    if (!task) {
        throw new Error(`Task not found: ${taskId}`);
    }

    if (
        task.status === status
        && (result === undefined || JSON.stringify(task.result ?? null) === JSON.stringify(result))
        && (retryCount === undefined || task.retryCount === retryCount)
        && (maxRetries === undefined || task.maxRetries === maxRetries)
    ) {
        return task;
    }

    const previousVersion = task.version;
    task.status = status;
    if (result !== undefined) {
        task.result = result;
    }
    if (typeof retryCount === "number") {
        task.retryCount = retryCount;
    }
    if (typeof maxRetries === "number") {
        task.maxRetries = maxRetries;
    }
    task.updatedBy = null;
    await task.save();

    const taskUpdatedPayload: TaskUpdatedPayload = {
        taskId: task._id.toString(),
        conversationId,
        patch: {
            status,
            ...(result !== undefined ? { result } : {}),
            ...(typeof retryCount === "number" ? { retryCount } : {}),
            ...(typeof maxRetries === "number" ? { maxRetries } : {}),
            updatedBy: null,
        },
        previousVersion,
        newVersion: task.version,
        updatedByType: "agent",
        updatedById: null,
    };

    await emitInternal("/internal/task-updated", conversationId, taskUpdatedPayload);
    return task;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object") {
        return value as Record<string, unknown>;
    }
    return {};
}

function stableStringify(value: unknown): string {
    if (value === null || value === undefined) return String(value);
    if (typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) {
        return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
    }

    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`).join(",")}}`;
}

function buildActionIdempotencyKey(payload: TaskExecutionRequestedPayload) {
    const parameterFingerprint = stableStringify(payload.parameters ?? {});
    return `task-action:${payload.taskId}:${payload.actionType}:${parameterFingerprint}`;
}

function getFallbackAdapterName(actionType: TaskExecutionActionType): string | null {
    if (actionType === "schedule_meeting" && process.env.SCHEDULE_MEETING_FALLBACK_WEBHOOK_URL) {
        return "schedule_meeting_fallback_webhook";
    }

    if (actionType === "send_email" && process.env.SEND_EMAIL_FALLBACK_WEBHOOK_URL) {
        return "send_email_fallback_webhook";
    }

    if (actionType === "create_github_issue" && process.env.GITHUB_ISSUE_FALLBACK_WEBHOOK_URL) {
        return "create_github_issue_fallback_webhook";
    }

    return null;
}

async function withIdempotencyGuard(
    payload: TaskExecutionRequestedPayload,
    operation: () => Promise<ActionExecutionResult>
): Promise<ActionExecutionResult> {
    const idempotencyKey = buildActionIdempotencyKey(payload);
    const doneKey = `task-worker:idempotent:done:${idempotencyKey}`;
    const lockKey = `task-worker:idempotent:lock:${idempotencyKey}`;

    if (!redis) {
        return operation();
    }

    const cached = await redis.get(doneKey);
    if (cached) {
        try {
            return JSON.parse(cached) as ActionExecutionResult;
        } catch {
            // Ignore malformed cache and continue with fresh execution.
        }
    }

    const lockAcquired = await redis.set(lockKey, WORKER_ID, "EX", 60, "NX");
    if (!lockAcquired) {
        for (let index = 0; index < 5; index += 1) {
            await wait(200);
            const replay = await redis.get(doneKey);
            if (!replay) continue;

            try {
                return JSON.parse(replay) as ActionExecutionResult;
            } catch {
                break;
            }
        }

        return {
            summary: "Skipped duplicate external action while idempotency lock was active.",
            adapterSuccess: true,
            evidence: {
                idempotencyKey,
                duplicateSkipped: true,
            },
        };
    }

    try {
        const result = await operation();
        if (result.adapterSuccess) {
            await redis.set(doneKey, JSON.stringify(result), "EX", 7 * 24 * 60 * 60);
        }
        return result;
    } finally {
        await redis.del(lockKey);
    }
}

function verifyEmailSent(result: ActionExecutionResult): VerificationOutcome {
    const evidence = asRecord(result.evidence);
    const responseStatus = typeof evidence.responseStatus === "number" ? evidence.responseStatus : 0;
    const responseBody = asRecord(evidence.responseBody);
    const messageId = typeof responseBody.id === "string" ? responseBody.id : "";

    if (result.adapterSuccess && responseStatus >= 200 && responseStatus < 300 && messageId.length > 0) {
        return { success: true, confidence: 0.96 };
    }

    if (result.adapterSuccess && responseStatus >= 200 && responseStatus < 300) {
        return { success: true, confidence: 0.78 };
    }

    return { success: false, confidence: 0.28 };
}

function verifyMeetingScheduled(result: ActionExecutionResult): VerificationOutcome {
    const evidence = asRecord(result.evidence);
    const responseStatus = typeof evidence.responseStatus === "number" ? evidence.responseStatus : 0;
    const responseBody = asRecord(evidence.responseBody);
    const hasMeetingMarker =
        typeof responseBody.meetingId === "string"
        || typeof responseBody.eventId === "string"
        || responseBody.scheduled === true;

    if (result.adapterSuccess && responseStatus >= 200 && responseStatus < 300 && hasMeetingMarker) {
        return { success: true, confidence: 0.94 };
    }

    if (result.adapterSuccess && responseStatus >= 200 && responseStatus < 300) {
        return { success: true, confidence: 0.72 };
    }

    return { success: false, confidence: 0.3 };
}

function verifyGithubIssueCreated(result: ActionExecutionResult): VerificationOutcome {
    const evidence = asRecord(result.evidence);
    const responseStatus = typeof evidence.responseStatus === "number" ? evidence.responseStatus : 0;
    const issue = asRecord(evidence.issue);
    const issueNumber = typeof issue.number === "number" ? issue.number : null;
    const issueUrl = typeof issue.html_url === "string" ? issue.html_url : "";

    if (result.adapterSuccess && responseStatus >= 200 && responseStatus < 300 && issueNumber !== null && issueUrl.length > 0) {
        return { success: true, confidence: 0.97 };
    }

    if (result.adapterSuccess && responseStatus >= 200 && responseStatus < 300) {
        return { success: true, confidence: 0.8 };
    }

    return { success: false, confidence: 0.24 };
}

function verifyActionResult(actionType: TaskExecutionActionType, result: ActionExecutionResult): VerificationOutcome {
    switch (actionType) {
        case "send_email":
            return verifyEmailSent(result);
        case "schedule_meeting":
            return verifyMeetingScheduled(result);
        case "create_github_issue":
            return verifyGithubIssueCreated(result);
        case "none":
        default:
            return {
                success: result.adapterSuccess,
                confidence: result.adapterSuccess ? 1 : 0,
            };
    }
}

async function executeCreateGithubIssueAction(payload: TaskExecutionRequestedPayload): Promise<ActionExecutionResult> {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;

    if (!token || !repo || !repo.includes("/")) {
        throw new Error("GitHub adapter is not configured. Set GITHUB_TOKEN and GITHUB_REPO=owner/repo.");
    }

    const title = typeof payload.parameters?.title === "string"
        ? payload.parameters.title
        : `Task: ${payload.taskId}`;
    const body = typeof payload.parameters?.body === "string"
        ? payload.parameters.body
        : `Auto-created from task ${payload.taskId} in conversation ${payload.conversationId}.`;

    const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: "POST",
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "chat-task-worker",
        },
        body: JSON.stringify({ title, body }),
    });

    const issue = (await response.json()) as { html_url?: string; number?: number; message?: string };

    if (!response.ok) {
        return {
            summary: `GitHub issue creation failed with status ${response.status}.`,
            adapterSuccess: false,
            evidence: {
                responseStatus: response.status,
                issue,
            },
            error: typeof issue.message === "string" ? issue.message : undefined,
        };
    }

    return {
        summary: `Created GitHub issue #${issue.number ?? "?"}${issue.html_url ? ` (${issue.html_url})` : ""}`,
        adapterSuccess: true,
        evidence: {
            responseStatus: response.status,
            issue,
        },
    };
}

async function executeScheduleMeetingAction(payload: TaskExecutionRequestedPayload): Promise<ActionExecutionResult> {
    const webhookUrl = process.env.SCHEDULE_MEETING_WEBHOOK_URL;
    if (!webhookUrl) {
        throw new Error("Schedule meeting adapter is not configured. Set SCHEDULE_MEETING_WEBHOOK_URL.");
    }

    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            taskId: payload.taskId,
            conversationId: payload.conversationId,
            triggerMessageId: payload.triggerMessageId,
            parameters: payload.parameters ?? {},
        }),
    });

    const responseText = await response.text();
    let responseBody: unknown = responseText;
    try {
        responseBody = responseText.length > 0 ? JSON.parse(responseText) : null;
    } catch {
        responseBody = responseText;
    }

    if (!response.ok) {
        return {
            summary: `Meeting scheduling failed with status ${response.status}.`,
            adapterSuccess: false,
            evidence: {
                responseStatus: response.status,
                responseBody,
            },
            error: typeof responseBody === "string" ? responseBody.slice(0, 500) : undefined,
        };
    }

    return {
        summary: "Scheduled meeting via external adapter.",
        adapterSuccess: true,
        evidence: {
            responseStatus: response.status,
            responseBody,
        },
    };
}

async function executeSendEmailAction(payload: TaskExecutionRequestedPayload): Promise<ActionExecutionResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !from) {
        throw new Error("Email adapter is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.");
    }

    const to = Array.isArray(payload.parameters?.to)
        ? payload.parameters?.to
        : typeof payload.parameters?.to === "string"
            ? [payload.parameters.to]
            : [];

    if (to.length === 0) {
        throw new Error("Email adapter requires parameters.to");
    }

    const subject = typeof payload.parameters?.subject === "string"
        ? payload.parameters.subject
        : `Task update ${payload.taskId}`;

    const body = typeof payload.parameters?.body === "string"
        ? payload.parameters.body
        : `Automated update for task ${payload.taskId}.`;

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from,
            to,
            subject,
            text: body,
        }),
    });

    const responseText = await response.text();
    let responseBody: unknown = responseText;
    try {
        responseBody = responseText.length > 0 ? JSON.parse(responseText) : null;
    } catch {
        responseBody = responseText;
    }

    if (!response.ok) {
        return {
            summary: `Email sending failed with status ${response.status}.`,
            adapterSuccess: false,
            evidence: {
                responseStatus: response.status,
                responseBody,
                to,
            },
            error: typeof responseBody === "string" ? responseBody.slice(0, 500) : undefined,
        };
    }

    return {
        summary: `Sent email to ${to.join(", ")}.`,
        adapterSuccess: true,
        evidence: {
            responseStatus: response.status,
            responseBody,
            to,
        },
    };
}

async function executeActionAdapter(payload: TaskExecutionRequestedPayload): Promise<ActionExecutionResult> {
    switch (payload.actionType) {
        case "create_github_issue":
            return executeCreateGithubIssueAction(payload);
        case "schedule_meeting":
            return executeScheduleMeetingAction(payload);
        case "send_email":
            return executeSendEmailAction(payload);
        case "none":
        default:
            return {
                summary: "No executable action selected.",
                adapterSuccess: true,
                evidence: { actionType: "none" },
            };
    }
}

async function executeScheduleMeetingFallbackAction(payload: TaskExecutionRequestedPayload): Promise<ActionExecutionResult> {
    const webhookUrl = process.env.SCHEDULE_MEETING_FALLBACK_WEBHOOK_URL;
    if (!webhookUrl) {
        return {
            summary: "No fallback adapter configured for meeting scheduling.",
            adapterSuccess: false,
            evidence: {
                adapter: "schedule_meeting_fallback_webhook",
                configured: false,
            },
            error: "SCHEDULE_MEETING_FALLBACK_WEBHOOK_URL is not set.",
        };
    }

    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            taskId: payload.taskId,
            conversationId: payload.conversationId,
            triggerMessageId: payload.triggerMessageId,
            parameters: payload.parameters ?? {},
        }),
    });

    const responseText = await response.text();
    let responseBody: unknown = responseText;
    try {
        responseBody = responseText.length > 0 ? JSON.parse(responseText) : null;
    } catch {
        responseBody = responseText;
    }

    return {
        summary: response.ok ? "Scheduled meeting via fallback adapter." : `Fallback meeting scheduling failed (${response.status}).`,
        adapterSuccess: response.ok,
        evidence: {
            adapter: "schedule_meeting_fallback_webhook",
            responseStatus: response.status,
            responseBody,
        },
        ...(response.ok ? {} : { error: typeof responseBody === "string" ? responseBody.slice(0, 500) : "Fallback adapter failure." }),
    };
}

async function executeSendEmailFallbackAction(payload: TaskExecutionRequestedPayload): Promise<ActionExecutionResult> {
    const webhookUrl = process.env.SEND_EMAIL_FALLBACK_WEBHOOK_URL;
    if (!webhookUrl) {
        return {
            summary: "No fallback adapter configured for send_email.",
            adapterSuccess: false,
            evidence: {
                adapter: "send_email_fallback_webhook",
                configured: false,
            },
            error: "SEND_EMAIL_FALLBACK_WEBHOOK_URL is not set.",
        };
    }

    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            taskId: payload.taskId,
            conversationId: payload.conversationId,
            triggerMessageId: payload.triggerMessageId,
            parameters: payload.parameters ?? {},
        }),
    });

    const responseText = await response.text();
    let responseBody: unknown = responseText;
    try {
        responseBody = responseText.length > 0 ? JSON.parse(responseText) : null;
    } catch {
        responseBody = responseText;
    }

    return {
        summary: response.ok ? "Sent email via fallback adapter." : `Fallback email sending failed (${response.status}).`,
        adapterSuccess: response.ok,
        evidence: {
            adapter: "send_email_fallback_webhook",
            responseStatus: response.status,
            responseBody,
        },
        ...(response.ok ? {} : { error: typeof responseBody === "string" ? responseBody.slice(0, 500) : "Fallback adapter failure." }),
    };
}

async function executeGithubIssueFallbackAction(payload: TaskExecutionRequestedPayload): Promise<ActionExecutionResult> {
    const webhookUrl = process.env.GITHUB_ISSUE_FALLBACK_WEBHOOK_URL;
    if (!webhookUrl) {
        return {
            summary: "No fallback adapter configured for create_github_issue.",
            adapterSuccess: false,
            evidence: {
                adapter: "create_github_issue_fallback_webhook",
                configured: false,
            },
            error: "GITHUB_ISSUE_FALLBACK_WEBHOOK_URL is not set.",
        };
    }

    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            taskId: payload.taskId,
            conversationId: payload.conversationId,
            triggerMessageId: payload.triggerMessageId,
            parameters: payload.parameters ?? {},
        }),
    });

    const responseText = await response.text();
    let responseBody: unknown = responseText;
    try {
        responseBody = responseText.length > 0 ? JSON.parse(responseText) : null;
    } catch {
        responseBody = responseText;
    }

    return {
        summary: response.ok ? "Created GitHub issue via fallback adapter." : `Fallback GitHub issue creation failed (${response.status}).`,
        adapterSuccess: response.ok,
        evidence: {
            adapter: "create_github_issue_fallback_webhook",
            responseStatus: response.status,
            responseBody,
        },
        ...(response.ok ? {} : { error: typeof responseBody === "string" ? responseBody.slice(0, 500) : "Fallback adapter failure." }),
    };
}

async function executeFallbackAdapter(payload: TaskExecutionRequestedPayload): Promise<ActionExecutionResult> {
    switch (payload.actionType) {
        case "schedule_meeting":
            return executeScheduleMeetingFallbackAction(payload);
        case "send_email":
            return executeSendEmailFallbackAction(payload);
        case "create_github_issue":
            return executeGithubIssueFallbackAction(payload);
        case "none":
        default:
            return {
                summary: "No fallback adapter for action type.",
                adapterSuccess: false,
                evidence: {
                    actionType: payload.actionType,
                },
                error: "Fallback adapter unavailable.",
            };
    }
}

async function executeActionWithFallback(payload: TaskExecutionRequestedPayload): Promise<ActionExecutionResult> {
    const primary = await executeActionAdapter(payload);
    if (primary.adapterSuccess) {
        return {
            ...primary,
            evidence: {
                primary: primary.evidence,
                fallbackUsed: false,
            },
        };
    }

    const fallbackAdapter = getFallbackAdapterName(payload.actionType);
    if (!fallbackAdapter) {
        return {
            summary: primary.summary,
            adapterSuccess: false,
            evidence: {
                primary: primary.evidence,
                fallbackUsed: false,
                fallbackConfigured: false,
            },
            error: primary.error ?? "Primary adapter failed.",
        };
    }

    const fallback = await executeFallbackAdapter(payload);
    if (fallback.adapterSuccess) {
        return {
            summary: `${primary.summary} Recovered via fallback adapter ${fallbackAdapter}.`,
            adapterSuccess: true,
            evidence: {
                primary: primary.evidence,
                fallback: fallback.evidence,
                fallbackUsed: true,
                fallbackAdapter,
            },
        };
    }

    return {
        summary: `${primary.summary} Fallback adapter ${fallbackAdapter} also failed.`,
        adapterSuccess: false,
        evidence: {
            primary: primary.evidence,
            fallback: fallback.evidence,
            fallbackUsed: true,
            fallbackAdapter,
        },
        error: fallback.error ?? primary.error ?? "Primary and fallback adapters failed.",
    };
}

function buildExecutionPlan(payload: NormalizedTaskExecutionRequestedPayload): ExecutionPlan {
    return {
        steps: [
            {
                name: "validate-request",
                phase: "plan",
                run: async () => {
                    if (!payload.taskId || !payload.conversationId) {
                        throw new Error("Task execution payload is missing identifiers.");
                    }
                },
            },
            {
                name: "load-task-and-transition",
                phase: "act",
                run: async (context) => {
                    const currentTask = await TaskModel.findById(payload.taskId);
                    if (!currentTask) {
                        throw new Error(`Task not found: ${payload.taskId}`);
                    }

                    context.currentTask = {
                        status: currentTask.status,
                    };

                    context.executionPolicy = {
                        retryCount: typeof currentTask.retryCount === "number" ? currentTask.retryCount : 0,
                        maxRetries: typeof currentTask.maxRetries === "number" ? currentTask.maxRetries : 2,
                    };

                    if (currentTask.status === "pending") {
                        await updateTaskLifecycle({
                            taskId: payload.taskId,
                            conversationId: payload.conversationId,
                            status: "executing",
                            retryCount: context.executionPolicy.retryCount,
                            maxRetries: context.executionPolicy.maxRetries,
                        });
                        context.currentTask.status = "executing";
                    }
                },
            },
            {
                name: "execute-action-adapter",
                phase: "act",
                run: async (context) => {
                    const retryCount = context.executionPolicy?.retryCount ?? 0;
                    const maxRetries = context.executionPolicy?.maxRetries ?? 2;

                    context.result = await retryManager.execute<ActionExecutionResult>({
                        retryCount,
                        maxRetries,
                        operation: async () => {
                            const result = await withIdempotencyGuard(payload, async () => executeActionWithFallback(payload));

                            if (!result.adapterSuccess) {
                                throw new Error(result.error ?? result.summary ?? "External adapter failed");
                            }

                            return result;
                        },
                        getReason: (error) => (error instanceof Error ? error.message : "unknown adapter error"),
                        onRetry: async ({ retryCount: nextRetryCount, maxRetries: limit, reason, delayMs }) => {
                            context.executionPolicy = {
                                retryCount: nextRetryCount,
                                maxRetries: limit,
                            };

                            console.warn("task execution retry attempt", {
                                taskId: payload.taskId,
                                actionType: payload.actionType,
                                retryCount: nextRetryCount,
                                maxRetries: limit,
                                delayMs,
                                reason,
                            });

                            await updateTaskLifecycle({
                                taskId: payload.taskId,
                                conversationId: payload.conversationId,
                                status: "executing",
                                retryCount: nextRetryCount,
                                maxRetries: limit,
                            });

                            await emitTaskExecutionUpdate({
                                taskId: payload.taskId,
                                conversationId: payload.conversationId,
                                state: "running",
                                actionType: payload.actionType,
                                summary: `retry ${nextRetryCount}/${limit} in ${delayMs}ms: ${reason}`,
                                error: null,
                                updatedAt: new Date().toISOString(),
                            });
                        },
                    });
                },
            },
            {
                name: "verify-execution-result",
                phase: "verify",
                run: async (context) => {
                    if (!context.result || typeof context.result.summary !== "string" || context.result.summary.trim().length === 0) {
                        throw new Error("Execution result verification failed: missing summary.");
                    }

                    context.verification = verifyActionResult(payload.actionType, context.result);
                },
            },
            {
                name: "finalize-task-status",
                phase: "verify",
                run: async (context) => {
                    if (!context.result || !context.verification) {
                        throw new Error("Execution finalization failed: missing verification context.");
                    }

                    const finalStatus = context.verification.success
                        ? "completed"
                        : (context.verification.confidence >= 0.5 ? "partial" : "failed");

                    const taskResult: TaskResult = {
                        success: context.verification.success,
                        confidence: clampConfidence(context.verification.confidence),
                        evidence: context.result.evidence,
                        ...(context.verification.success
                            ? {}
                            : { error: context.result.error ?? "Verification did not pass." }),
                    };

                    await updateTaskLifecycle({
                        taskId: payload.taskId,
                        conversationId: payload.conversationId,
                        status: finalStatus,
                        result: taskResult,
                    });
                },
            },
        ],
    };
}

async function emitExecutionStepProgress(input: {
    payload: NormalizedTaskExecutionRequestedPayload;
    step: ExecutionStep;
    stepIndex: number;
    totalSteps: number;
    attempt: number;
}) {
    const { payload, step, stepIndex, totalSteps, attempt } = input;
    await emitTaskExecutionUpdate({
        taskId: payload.taskId,
        conversationId: payload.conversationId,
        state: "running",
        actionType: payload.actionType,
        summary: `phase=${step.phase} step=${step.name} progress=${stepIndex + 1}/${totalSteps} attempt=${attempt}`,
        error: null,
        updatedAt: new Date().toISOString(),
    });
}

async function runExecutionPlan(payload: NormalizedTaskExecutionRequestedPayload, plan: ExecutionPlan) {
    const context: ExecutionContext = {
        payload,
        currentTask: null,
        executionPolicy: null,
        result: null,
        verification: null,
    };

    const totalSteps = plan.steps.length;

    for (let stepIndex = 0; stepIndex < totalSteps; stepIndex += 1) {
        const step = plan.steps[stepIndex];
        const maxAttempts = Math.max(step.maxAttempts ?? 1, 1);
        let attempt = 0;

        while (attempt < maxAttempts) {
            attempt += 1;
            await emitExecutionStepProgress({
                payload,
                step,
                stepIndex,
                totalSteps,
                attempt,
            });

            try {
                await step.run(context);
                break;
            } catch (error) {
                const canRetry = Boolean(step.retryable) && attempt < maxAttempts;
                if (!canRetry) {
                    const message = error instanceof Error ? error.message : "Unknown execution step failure";
                    throw new Error(`Execution step '${step.name}' failed: ${message}`);
                }
                await wait(250 * attempt);
            }
        }
    }

    return context.result;
}

async function processTaskExecutionRequested(payload: NormalizedTaskExecutionRequestedPayload) {
    const queuedAt = new Date().toISOString();

    await emitTaskExecutionUpdate({
        taskId: payload.taskId,
        conversationId: payload.conversationId,
        state: "queued",
        actionType: payload.actionType,
        summary: null,
        error: null,
        updatedAt: queuedAt,
    });

    const confidence = payload.confidence ?? 0.5;
    const requiresApproval = Boolean(payload.needsApproval) || confidence < 0.7;

    if (requiresApproval) {
        await updateTaskLifecycle({
            taskId: payload.taskId,
            conversationId: payload.conversationId,
            status: "partial",
            result: {
                success: false,
                confidence: clampConfidence(confidence),
                evidence: {
                    reason: "approval_required",
                    requestedConfidence: confidence,
                },
                error: "Approval required before executing this action.",
            },
        });
        await emitTaskExecutionUpdate({
            taskId: payload.taskId,
            conversationId: payload.conversationId,
            state: "failed",
            actionType: payload.actionType,
            summary: null,
            error: "Approval required before executing this action.",
            updatedAt: new Date().toISOString(),
        });
        return;
    }

    const runningAt = new Date().toISOString();
    const plan = buildExecutionPlan(payload);

    await emitTaskExecutionUpdate({
        taskId: payload.taskId,
        conversationId: payload.conversationId,
        state: "running",
        actionType: payload.actionType,
        summary: `Execution plan initialized with ${plan.steps.length} steps.`,
        error: null,
        updatedAt: runningAt,
    });

    let execution: ActionExecutionResult | null = null;
    try {
        execution = await runExecutionPlan(payload, plan);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Task execution failed";

        await updateTaskLifecycle({
            taskId: payload.taskId,
            conversationId: payload.conversationId,
            status: "failed",
            result: {
                success: false,
                confidence: 0,
                evidence: {
                    phase: "execution",
                    actionType: payload.actionType,
                },
                error: message,
            },
        });

        await emitTaskExecutionUpdate({
            taskId: payload.taskId,
            conversationId: payload.conversationId,
            state: "failed",
            actionType: payload.actionType,
            summary: null,
            error: message,
            updatedAt: new Date().toISOString(),
        });

        throw error;
    }

    await emitTaskExecutionUpdate({
        taskId: payload.taskId,
        conversationId: payload.conversationId,
        state: "succeeded",
        actionType: payload.actionType,
        summary: execution?.summary ?? "Execution plan completed.",
        error: null,
        updatedAt: new Date().toISOString(),
    });
}

async function ensureDatabaseConnection() {
    if (mongoose.connection.readyState === 1) {
        return;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI is not defined");
    }

    await mongoose.connect(uri, {
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
    });
}

async function processOneEvent(event: {
    _id: { toString(): string };
    topic: string;
    dedupeKey: string;
    payload: Record<string, unknown>;
    attempts: number;
}) {
    const { complete } = getOutboxFns();
    const eventId = event._id.toString();
    const processedKey = `task-worker:processed:${event.dedupeKey}`;

    let shouldProcess = true;
    if (redis) {
        const acquired = await redis.set(processedKey, WORKER_ID, "EX", 7 * 24 * 60 * 60, "NX");
        shouldProcess = Boolean(acquired);
    }

    if (!shouldProcess) {
        await complete(eventId);
        return;
    }

    try {
        if (event.topic === "message.created") {
            const processIntelligence = getIntelligenceFn();

            if (!isMessageCreatedPayload(event.payload)) {
                throw new Error("Invalid message.created payload shape");
            }

            const intelligence = await processIntelligence({
                messageId: event.payload.messageId,
                conversationId: event.payload.conversationId,
                senderId: event.payload.senderId,
                content: event.payload.content,
                messageType: event.payload.messageType,
            });

            if (intelligence) {
                await emitInternal(
                    "/internal/message-semantic-updated",
                    intelligence.semanticPayload.conversationId,
                    intelligence.semanticPayload
                );

                if (intelligence.taskCreatedPayload) {
                    await emitInternal(
                        "/internal/task-created",
                        intelligence.semanticPayload.conversationId,
                        intelligence.taskCreatedPayload
                    );
                }

                if (intelligence.taskUpdatedPayload) {
                    await emitInternal(
                        "/internal/task-updated",
                        intelligence.semanticPayload.conversationId,
                        intelligence.taskUpdatedPayload
                    );
                }

                if (intelligence.taskLinkedPayload) {
                    await emitInternal(
                        "/internal/task-linked-to-message",
                        intelligence.semanticPayload.conversationId,
                        intelligence.taskLinkedPayload
                    );
                }
            }

            await complete(eventId);
            return;
        }

        if (event.topic === "task.execution.requested") {
            if (!isTaskExecutionRequestedPayload(event.payload)) {
                throw new Error("Invalid task.execution.requested payload shape");
            }

            try {
                await agentRunner.runTask(String(event.payload.taskId));
            } catch (error) {
                throw error;
            }

            await complete(eventId);
            return;
        }

        await complete(eventId);
        return;

    } catch (error) {
        if (redis) {
            await redis.del(processedKey);
        }
        throw error;
    }
}

async function run() {
    const { claim, fail } = getOutboxFns();

    if (!process.env.MONGODB_URI) {
        console.warn("task-worker disabled: MONGODB_URI is not set. Set MONGODB_URI to enable task processing.");
        // Keep process alive so monorepo dev does not fail hard when worker env is missing.
        // eslint-disable-next-line no-constant-condition
        while (true) {
            await wait(10_000);
        }
    }

    await ensureDatabaseConnection();

    if (redis) {
        await redis.connect();
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const events = await claim(WORKER_ID, BATCH_SIZE);

        if (events.length === 0) {
            await wait(POLL_INTERVAL_MS);
            continue;
        }

        for (const event of events) {
            try {
                await processOneEvent(event);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Outbox worker failure";
                await fail(event._id.toString(), message, computeRetryDelay(event.attempts));
                console.error("task-worker event processing failed", {
                    workerId: WORKER_ID,
                    eventId: event._id.toString(),
                    topic: event.topic,
                    attempts: event.attempts,
                    error: message,
                });
            }
        }
    }
}

run().catch((error) => {
    console.error("task-worker fatal error", error);
    process.exit(1);
});