import { config as loadEnv } from "dotenv";
import Redis from "ioredis";
import mongoose from "mongoose";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TaskExecutionActionType, TaskExecutionUpdatedPayload, TaskUpdatedPayload } from "@chat/types";
import * as outboxModule from "../../packages/services/outbox.service";
import * as intelligenceModule from "../../packages/services/task-intelligence.service";
import TaskModel from "../../packages/db/models/Task";

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

type ActionExecutionResult = {
    summary: string;
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
        && typeof payload.triggerMessageId === "string"
        && typeof payload.requestedByType === "string"
        && typeof payload.actionType === "string"
        && ["create_github_issue", "schedule_meeting", "send_email", "none"].includes(payload.actionType)
    );
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

async function applyTaskStatus(taskId: string, conversationId: string, nextStatus: "in_progress" | "done" | "blocked") {
    const task = await TaskModel.findById(taskId);
    if (!task) {
        throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status === nextStatus) {
        return task;
    }

    const previousVersion = task.version;
    task.status = nextStatus;
    task.updatedBy = null;
    await task.save();

    const taskUpdatedPayload: TaskUpdatedPayload = {
        taskId: task._id.toString(),
        conversationId,
        patch: {
            status: nextStatus,
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

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub issue creation failed (${response.status}): ${errorText.slice(0, 500)}`);
    }

    const issue = (await response.json()) as { html_url?: string; number?: number };
    return {
        summary: `Created GitHub issue #${issue.number ?? "?"}${issue.html_url ? ` (${issue.html_url})` : ""}`,
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

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Meeting scheduling failed (${response.status}): ${errorText.slice(0, 500)}`);
    }

    return {
        summary: "Scheduled meeting via external adapter.",
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

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Email sending failed (${response.status}): ${errorText.slice(0, 500)}`);
    }

    return {
        summary: `Sent email to ${to.join(", ")}.`,
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
            };
    }
}

async function processTaskExecutionRequested(payload: TaskExecutionRequestedPayload) {
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

    const confidence = typeof payload.confidence === "number" ? payload.confidence : 0.5;
    const requiresApproval = Boolean(payload.needsApproval) || confidence < 0.7;

    if (requiresApproval) {
        await applyTaskStatus(payload.taskId, payload.conversationId, "blocked");
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

    await emitTaskExecutionUpdate({
        taskId: payload.taskId,
        conversationId: payload.conversationId,
        state: "running",
        actionType: payload.actionType,
        summary: null,
        error: null,
        updatedAt: runningAt,
    });

    const currentTask = await TaskModel.findById(payload.taskId);
    if (!currentTask) {
        throw new Error(`Task not found: ${payload.taskId}`);
    }

    if (currentTask.status === "open") {
        await applyTaskStatus(payload.taskId, payload.conversationId, "in_progress");
    }

    const execution = await executeActionAdapter(payload);

    const latestTask = await TaskModel.findById(payload.taskId);
    if (latestTask && latestTask.status !== "done" && latestTask.status !== "canceled") {
        await applyTaskStatus(payload.taskId, payload.conversationId, "done");
    }

    await emitTaskExecutionUpdate({
        taskId: payload.taskId,
        conversationId: payload.conversationId,
        state: "succeeded",
        actionType: payload.actionType,
        summary: execution.summary,
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
                await processTaskExecutionRequested(event.payload);
            } catch (error) {
                const message = error instanceof Error ? error.message : "Task execution failed";
                await emitTaskExecutionUpdate({
                    taskId: event.payload.taskId,
                    conversationId: event.payload.conversationId,
                    state: "failed",
                    actionType: event.payload.actionType,
                    summary: null,
                    error: message,
                    updatedAt: new Date().toISOString(),
                });
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