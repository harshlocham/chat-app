import type { TaskExecutionActionType, TaskResult, TaskUpdatedPayload } from "@chat/types";
import { RetryManager } from "./retry-manager.js";
import * as taskRepo from "../../../packages/services/repositories/task.repo";
import * as taskModule from "../../../packages/db/models/Task";

const INTERNAL_SECRET_HEADER = "x-internal-secret";

type TaskModelLike = {
    findById: (id: string) => Promise<TaskDocumentLike | null>;
};

type ExecutionActionRecord = {
    taskId: string;
    conversationId: string;
    actionType: TaskExecutionActionType;
    parameters: Record<string, unknown>;
    messageId: string | null;
    executionState: string | null;
};

type TaskDocumentLike = {
    _id: { toString(): string };
    conversationId: { toString(): string };
    title: string;
    description: string;
    status: string;
    retryCount?: number;
    maxRetries?: number;
    result?: TaskResult;
    version: number;
    updatedBy: null | string;
    save: () => Promise<void>;
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

type LoopContext = {
    task: TaskDocumentLike;
    action: ExecutionActionRecord;
    retryCount: number;
    maxRetries: number;
    attemptPayload: ExecutionActionRecord;
    observed: ActionExecutionResult | null;
    verification: VerificationOutcome | null;
};

function wait(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
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

    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

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

    throw new Error(`Task model exports are invalid. keys=${Object.keys(asRecord || {}).join(",")}`);
}

export class AgentRunner {
    private readonly retryManager: RetryManager;
    private readonly taskModel: TaskModelLike;
    private readonly internalBaseUrl: string;

    constructor(options?: {
        retryManager?: RetryManager;
        taskModel?: TaskModelLike;
        internalBaseUrl?: string;
    }) {
        this.retryManager = options?.retryManager ?? new RetryManager([1000, 2000, 5000]);
        this.taskModel = options?.taskModel ?? resolveTaskModel(taskModule);
        this.internalBaseUrl = options?.internalBaseUrl ?? process.env.SOCKET_SERVER_URL ?? process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
    }

    async runTask(taskId: string) {
        const task = await this.taskModel.findById(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        const action = await taskRepo.getLatestExecutionTaskAction(taskId);
        if (!action) {
            throw new Error(`No execution action found for task: ${taskId}`);
        }

        const context: LoopContext = {
            task,
            action: {
                taskId: action.taskId.toString(),
                conversationId: action.conversationId.toString(),
                actionType: action.actionType as TaskExecutionActionType,
                parameters: action.parameters ?? {},
                messageId: action.messageId ? action.messageId.toString() : null,
                executionState: action.executionState ?? null,
            },
            retryCount: typeof task.retryCount === "number" ? task.retryCount : 0,
            maxRetries: typeof task.maxRetries === "number" ? task.maxRetries : 2,
            attemptPayload: {
                taskId: action.taskId.toString(),
                conversationId: action.conversationId.toString(),
                actionType: action.actionType as TaskExecutionActionType,
                parameters: action.parameters ?? {},
                messageId: action.messageId ? action.messageId.toString() : null,
                executionState: action.executionState ?? null,
            },
            observed: null,
            verification: null,
        };

        console.log("agent-runner lifecycle:start", {
            taskId,
            actionType: context.action.actionType,
            retryCount: context.retryCount,
            maxRetries: context.maxRetries,
        });

        await this.updateTask(task, {
            status: "executing",
            retryCount: context.retryCount,
            maxRetries: context.maxRetries,
        });

        while (context.retryCount < context.maxRetries && task.status !== "completed") {
            console.log("agent-runner lifecycle:loop", {
                taskId,
                actionType: context.attemptPayload.actionType,
                retryCount: context.retryCount,
                maxRetries: context.maxRetries,
            });

            try {
                const executed = await this.execute(context.attemptPayload);
                context.observed = await this.observe(context, executed);
                context.verification = await this.verify(context.observed, context);

                if (context.verification.success) {
                    await this.updateTask(task, {
                        status: "completed",
                        retryCount: context.retryCount,
                        maxRetries: context.maxRetries,
                        result: {
                            success: true,
                            confidence: context.verification.confidence,
                            evidence: context.observed.evidence,
                        },
                    });
                    console.log("agent-runner lifecycle:completed", {
                        taskId,
                        confidence: context.verification.confidence,
                    });
                    return {
                        completed: true,
                        retryCount: context.retryCount,
                        maxRetries: context.maxRetries,
                        result: context.observed,
                        verification: context.verification,
                    };
                }

                if (context.retryCount >= context.maxRetries - 1) {
                    await this.updateTask(task, {
                        status: "failed",
                        retryCount: context.retryCount + 1,
                        maxRetries: context.maxRetries,
                        result: {
                            success: false,
                            confidence: context.verification.confidence,
                            evidence: context.observed.evidence,
                            error: "Verification failed and retries exhausted.",
                        },
                    });
                    console.log("agent-runner lifecycle:failed", {
                        taskId,
                        retryCount: context.retryCount + 1,
                        maxRetries: context.maxRetries,
                        confidence: context.verification.confidence,
                    });
                    return {
                        completed: false,
                        retryCount: context.retryCount + 1,
                        maxRetries: context.maxRetries,
                        result: context.observed,
                        verification: context.verification,
                    };
                }

                const adjusted = await this.adjust(context, context.observed, context.verification);
                context.attemptPayload = adjusted;
                context.retryCount += 1;

                console.warn("agent-runner lifecycle:retry", {
                    taskId,
                    retryCount: context.retryCount,
                    maxRetries: context.maxRetries,
                    reason: context.observed.error ?? "verification failed",
                    adjustment: adjusted.parameters,
                });

                await this.updateTask(task, {
                    status: "executing",
                    retryCount: context.retryCount,
                    maxRetries: context.maxRetries,
                });

                if (context.retryCount < context.maxRetries) {
                    await wait(this.getBackoffDelay(context.retryCount));
                }
            } catch (error) {
                const reason = error instanceof Error ? error.message : "unknown execution error";

                if (context.retryCount >= context.maxRetries - 1) {
                    await this.updateTask(task, {
                        status: "failed",
                        retryCount: context.retryCount + 1,
                        maxRetries: context.maxRetries,
                        result: {
                            success: false,
                            confidence: 0,
                            evidence: {
                                phase: "execute",
                                reason,
                            },
                            error: reason,
                        },
                    });
                    console.error("agent-runner lifecycle:terminal-failure", {
                        taskId,
                        reason,
                        retryCount: context.retryCount + 1,
                        maxRetries: context.maxRetries,
                    });
                    throw error;
                }

                const adjusted = await this.adjust(context, context.observed, { success: false, confidence: 0 });
                context.attemptPayload = adjusted;
                context.retryCount += 1;

                console.warn("agent-runner lifecycle:retry-after-error", {
                    taskId,
                    retryCount: context.retryCount,
                    maxRetries: context.maxRetries,
                    reason,
                    adjustment: adjusted.parameters,
                });

                await this.updateTask(task, {
                    status: "executing",
                    retryCount: context.retryCount,
                    maxRetries: context.maxRetries,
                });

                await wait(this.getBackoffDelay(context.retryCount));
            }
        }

        await this.updateTask(task, {
            status: "failed",
            retryCount: context.retryCount,
            maxRetries: context.maxRetries,
            result: {
                success: false,
                confidence: context.verification?.confidence ?? 0,
                evidence: context.observed?.evidence ?? null,
                error: "Retries exhausted.",
            },
        });

        console.log("agent-runner lifecycle:exhausted", {
            taskId,
            retryCount: context.retryCount,
            maxRetries: context.maxRetries,
        });

        return {
            completed: false,
            retryCount: context.retryCount,
            maxRetries: context.maxRetries,
            result: context.observed,
            verification: context.verification,
        };
    }

    private async execute(payload: ExecutionActionRecord): Promise<ActionExecutionResult> {
        console.log("agent-runner step:execute", {
            taskId: payload.taskId,
            actionType: payload.actionType,
            parameters: payload.parameters,
        });

        switch (payload.actionType) {
            case "send_email":
                return this.executeSendEmail(payload);
            case "schedule_meeting":
                return this.executeScheduleMeeting(payload);
            case "create_github_issue":
                return this.executeGithubIssue(payload);
            default:
                return {
                    summary: "No executable action selected.",
                    adapterSuccess: true,
                    evidence: { actionType: payload.actionType },
                };
        }
    }

    private async observe(_context: LoopContext, result: ActionExecutionResult): Promise<ActionExecutionResult> {
        console.log("agent-runner step:observe", {
            summary: result.summary,
            adapterSuccess: result.adapterSuccess,
        });

        return result;
    }

    private async verify(result: ActionExecutionResult, context: LoopContext): Promise<VerificationOutcome> {
        console.log("agent-runner step:verify", {
            actionType: context.action.actionType,
            evidence: result.evidence,
        });

        switch (context.action.actionType) {
            case "send_email":
                return this.verifyEmailSent(result);
            case "schedule_meeting":
                return this.verifyMeetingScheduled(result);
            case "create_github_issue":
                return this.verifyGithubIssueCreated(result);
            default:
                return {
                    success: result.adapterSuccess,
                    confidence: result.adapterSuccess ? 1 : 0,
                };
        }
    }

    private async adjust(context: LoopContext, result: ActionExecutionResult | null, verification: VerificationOutcome): Promise<ExecutionActionRecord> {
        const nextParameters = { ...(context.attemptPayload.parameters ?? {}) };

        if (context.action.actionType === "send_email") {
            nextParameters.subject = typeof nextParameters.subject === "string" && nextParameters.subject.trim().length > 0
                ? nextParameters.subject
                : `${context.task.title} - follow up`;
            nextParameters.body = typeof nextParameters.body === "string" && nextParameters.body.trim().length > 0
                ? nextParameters.body
                : `${context.task.description || context.task.title}`;
            if (!nextParameters.to && process.env.RESEND_FROM_EMAIL) {
                nextParameters.to = [process.env.RESEND_FROM_EMAIL];
            }
        }

        if (context.action.actionType === "schedule_meeting") {
            nextParameters.summary = typeof nextParameters.summary === "string" && nextParameters.summary.trim().length > 0
                ? nextParameters.summary
                : context.task.title;
            nextParameters.notes = typeof nextParameters.notes === "string" && nextParameters.notes.trim().length > 0
                ? nextParameters.notes
                : context.task.description || context.task.title;
            if (!nextParameters.whenText) {
                nextParameters.whenText = "next available slot";
            }
        }

        if (context.action.actionType === "create_github_issue") {
            nextParameters.title = typeof nextParameters.title === "string" && nextParameters.title.trim().length > 0
                ? nextParameters.title
                : context.task.title;
            nextParameters.body = typeof nextParameters.body === "string" && nextParameters.body.trim().length > 0
                ? nextParameters.body
                : context.task.description || context.task.title;
            if (!Array.isArray(nextParameters.labels)) {
                nextParameters.labels = ["retry-adjusted"];
            }
        }

        const adjusted = {
            ...context.attemptPayload,
            parameters: nextParameters,
        };

        console.log("agent-runner step:adjust", {
            taskId: context.task._id.toString(),
            actionType: context.action.actionType,
            retryCount: context.retryCount,
            verificationConfidence: verification.confidence,
            adjustedParameters: nextParameters,
            previousSummary: result?.summary ?? null,
        });

        return adjusted;
    }

    private verifyEmailSent(result: ActionExecutionResult): VerificationOutcome {
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

    private verifyMeetingScheduled(result: ActionExecutionResult): VerificationOutcome {
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

    private verifyGithubIssueCreated(result: ActionExecutionResult): VerificationOutcome {
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

    private async executeSendEmail(payload: ExecutionActionRecord): Promise<ActionExecutionResult> {
        const apiKey = process.env.RESEND_API_KEY;
        const from = process.env.RESEND_FROM_EMAIL;

        if (!apiKey || !from) {
            throw new Error("Email adapter is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.");
        }

        const to = Array.isArray(payload.parameters?.to)
            ? payload.parameters.to
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

        return {
            summary: response.ok ? `Sent email to ${to.join(", ")}.` : `Email sending failed with status ${response.status}.`,
            adapterSuccess: response.ok,
            evidence: {
                responseStatus: response.status,
                responseBody,
                to,
            },
            ...(response.ok ? {} : { error: typeof responseBody === "string" ? responseBody.slice(0, 500) : undefined }),
        };
    }

    private async executeScheduleMeeting(payload: ExecutionActionRecord): Promise<ActionExecutionResult> {
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
                triggerMessageId: payload.messageId,
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
            summary: response.ok ? "Scheduled meeting via external adapter." : `Meeting scheduling failed with status ${response.status}.`,
            adapterSuccess: response.ok,
            evidence: {
                responseStatus: response.status,
                responseBody,
            },
            ...(response.ok ? {} : { error: typeof responseBody === "string" ? responseBody.slice(0, 500) : undefined }),
        };
    }

    private async executeGithubIssue(payload: ExecutionActionRecord): Promise<ActionExecutionResult> {
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

        return {
            summary: response.ok ? `Created GitHub issue #${issue.number ?? "?"}${issue.html_url ? ` (${issue.html_url})` : ""}` : `GitHub issue creation failed with status ${response.status}.`,
            adapterSuccess: response.ok,
            evidence: {
                responseStatus: response.status,
                issue,
            },
            ...(response.ok ? {} : { error: typeof issue.message === "string" ? issue.message : undefined }),
        };
    }

    private getBackoffDelay(retryCount: number) {
        const schedule = [1000, 2000, 5000] as const;
        return schedule[Math.min(Math.max(retryCount - 1, 0), schedule.length - 1)] ?? 0;
    }

    private async updateTask(task: TaskDocumentLike, patch: {
        status?: string;
        retryCount?: number;
        maxRetries?: number;
        result?: TaskResult;
    }) {
        const previousVersion = task.version;
        let changed = false;

        if (patch.status !== undefined && task.status !== patch.status) {
            task.status = patch.status;
            changed = true;
        }
        if (patch.retryCount !== undefined && task.retryCount !== patch.retryCount) {
            task.retryCount = patch.retryCount;
            changed = true;
        }
        if (patch.maxRetries !== undefined && task.maxRetries !== patch.maxRetries) {
            task.maxRetries = patch.maxRetries;
            changed = true;
        }
        if (patch.result !== undefined && JSON.stringify(task.result ?? null) !== JSON.stringify(patch.result)) {
            task.result = patch.result;
            changed = true;
        }

        if (!changed) {
            return task;
        }

        task.updatedBy = null;
        await task.save();

        const payload: TaskUpdatedPayload = {
            taskId: task._id.toString(),
            conversationId: task.conversationId.toString(),
            patch: {
                ...(patch.status !== undefined ? { status: patch.status as any } : {}),
                ...(patch.retryCount !== undefined ? { retryCount: patch.retryCount } : {}),
                ...(patch.maxRetries !== undefined ? { maxRetries: patch.maxRetries } : {}),
                ...(patch.result !== undefined ? { result: patch.result } : {}),
                updatedBy: null,
            },
            previousVersion,
            newVersion: task.version,
            updatedByType: "agent",
            updatedById: null,
        };

        await this.emitTaskUpdated(task.conversationId.toString(), payload);
        return task;
    }

    private async emitTaskUpdated(conversationId: string, payload: TaskUpdatedPayload) {
        const internalSecret = process.env.INTERNAL_SECRET || "";
        await fetch(`${this.internalBaseUrl}/internal/task-updated`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(internalSecret ? { [INTERNAL_SECRET_HEADER]: internalSecret } : {}),
            },
            body: JSON.stringify({
                conversationId,
                payload,
            }),
        });
    }
}

export default AgentRunner;
