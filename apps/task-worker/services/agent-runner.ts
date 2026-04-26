import type { TaskCheckpoint, TaskExecutionActionType, TaskExecutionHistory, TaskResult, TaskUpdatedPayload, TaskValidationLog } from "@chat/types";
import { RetryManager } from "./retry-manager.js";
import * as taskRepo from "@chat/services/repositories/task.repo";
import * as taskModule from "@chat/db/models/Task";
import TaskPlanModel from "@chat/db/models/TaskPlan";
import ToolRegistry from "./tools/tool-registry.js";
import TaskSuccessRegistry, { createDefaultTaskSuccessRegistry } from "./task-success-registry.js";
import { CreateIssueTool } from "./tools/create-issue.tool.js";
import { ScheduleMeetingTool } from "./tools/schedule-meeting.tool.js";
import { SendEmailTool } from "./tools/send-email.tool.js";
import { createOrRefreshTaskPlan, getTaskPlan } from "./planner.js";
import { retrieveMemory } from "./memory-service.js";
import { generateAndStoreReflection } from "./reflection-service.js";
import { acquireTaskLease, heartbeatTaskLease, releaseTaskLease } from "./task-lease.js";
import { assertTransition } from "./task-state-machine.js";
import { rankTools, type ToolRankingInput } from "./tool-ranking.js";

const INTERNAL_SECRET_HEADER = "x-internal-secret";

type TaskModelLike = {
    findById: (id: string) => Promise<TaskDocumentLike | null>;
};

type ExecutionActionRecord = {
    taskId: string;
    conversationId: string;
    toolName: string;
    parameters: Record<string, unknown>;
    messageId: string | null;
    executionState: string | null;
};

type TaskDocumentLike = {
    _id: { toString(): string };
    conversationId: { toString(): string };
    parentTaskId?: { toString(): string } | null;
    lifecycleState?: "planning" | "ready" | "executing" | "waiting_for_approval" | "blocked" | "retry_scheduled" | "paused" | "completed" | "failed";
    sourceMessageIds?: Array<{ toString(): string }>;
    title: string;
    description: string;
    status: string;
    subTasks?: Array<{ toString(): string }>;
    dependencyIds?: Array<{ toString(): string }>;
    retryCount?: number;
    maxRetries?: number;
    currentStepId?: string | null;
    iterationCount?: number;
    leaseOwner?: string | null;
    leaseExpiresAt?: Date | null;
    blockedReason?: string | null;
    pausedReason?: string | null;
    progress?: number;
    checkpoints?: TaskCheckpoint[];
    executionHistory?: TaskExecutionHistory;
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
    validationLog?: TaskValidationLog;
};

type AvailableToolForDecision = {
    name: string;
    description: string;
    inputSchema: unknown;
};

type NextActionDecision = {
    toolName: string;
    toolInput: Record<string, unknown>;
    reasoning?: string;
    goalAchieved?: boolean;
    noAction?: boolean;
    needsClarification?: boolean;
    clarificationQuestion?: string;
};

type IterationContextEntry = {
    iteration: number;
    decision: {
        toolName: string | null;
        reasoning?: string;
        noAction?: boolean;
        needsClarification?: boolean;
    };
    result?: {
        summary: string;
        adapterSuccess: boolean;
        error?: string;
    };
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

type RunTaskOutcome = {
    completed: boolean;
    retryCount: number;
    maxRetries: number;
    result: ActionExecutionResult | null;
    verification: VerificationOutcome | null;
};

type PlanStepLike = {
    stepId: string;
    title: string;
    description: string;
    kind: "tool_call" | "decision" | "approval" | "notification" | "validation";
    state: "ready" | "running" | "waiting_for_dependency" | "waiting_for_approval" | "retry_scheduled" | "blocked" | "completed" | "failed" | "skipped";
    order: number;
    dependencies: string[];
    fallbackPolicy: "dependency_preserving" | "immediate_execution";
    overrideDependencies: boolean;
    fallback: Array<{ stepId: string; reason: string }>;
    successCriteria: string[];
    toolCandidates: Array<{ toolName: string; confidence: number; riskLevel: "low" | "medium" | "high" }>;
    selectedToolName?: string | null;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    attempts: number;
    maxAttempts: number;
    lastError?: string | null;
    startedAt?: Date | string | null;
    completedAt?: Date | string | null;
};

type TaskPlanLike = {
    taskId: { toString(): string };
    status: "draft" | "approved" | "active" | "completed" | "failed" | "cancelled";
    steps: PlanStepLike[];
    activeStepId?: string | null;
};

type RetrieveMemoryFn = typeof retrieveMemory;
type GetTaskPlanFn = typeof getTaskPlan;
type CreateOrRefreshTaskPlanFn = typeof createOrRefreshTaskPlan;
type GenerateAndStoreReflectionFn = typeof generateAndStoreReflection;
type AcquireTaskLeaseFn = typeof acquireTaskLease;
type HeartbeatTaskLeaseFn = typeof heartbeatTaskLease;
type ReleaseTaskLeaseFn = typeof releaseTaskLease;
type AssertTransitionFn = typeof assertTransition;
type UpdatePlanStepStateFn = (taskId: string, stepId: string, patch: Partial<PlanStepLike>) => Promise<void>;

type LatestExecutionTaskAction = {
    taskId: { toString(): string };
    conversationId: { toString(): string };
    actionType: string;
    toolName?: string | null;
    parameters?: Record<string, unknown> | null;
    messageId?: { toString(): string } | null;
    executionState?: string | null;
};

type GetLatestExecutionTaskAction = (taskId: string) => Promise<LatestExecutionTaskAction | null>;

type ExecutionHistoryDelta = {
    attempts?: number;
    failures?: number;
    appendResult?: {
        attempt: number;
        success: boolean;
        summary: string;
        error?: string;
        validationLog?: TaskValidationLog;
    };
};

function wait(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
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

function resolveGetLatestExecutionTaskAction(
    moduleNs: unknown
): GetLatestExecutionTaskAction {
    const asRecord = moduleNs as Record<string, unknown>;
    const defaultExport = asRecord?.default as Record<string, unknown> | undefined;
    const candidates: unknown[] = [
        asRecord?.getLatestExecutionTaskAction,
        defaultExport?.getLatestExecutionTaskAction,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "function") {
            return candidate as GetLatestExecutionTaskAction;
        }
    }

    throw new Error(`Task repository exports are invalid. keys=${Object.keys(asRecord || {}).join(",")}`);
}

export const __testInternals = {
    resolveGetLatestExecutionTaskAction,
};

export class AgentRunner {
    private readonly retryManager: RetryManager;
    private readonly taskModel: TaskModelLike;
    private readonly toolRegistry: ToolRegistry;
    private readonly taskSuccessRegistry: TaskSuccessRegistry;
    private readonly internalBaseUrl: string;
    private readonly getLatestExecutionTaskAction: GetLatestExecutionTaskAction;
    private readonly persistentLoopEnabled: boolean;
    private readonly workerId: string;
    private readonly retrieveMemoryFn: RetrieveMemoryFn;
    private readonly getTaskPlanFn: GetTaskPlanFn;
    private readonly createOrRefreshTaskPlanFn: CreateOrRefreshTaskPlanFn;
    private readonly generateAndStoreReflectionFn: GenerateAndStoreReflectionFn;
    private readonly acquireTaskLeaseFn: AcquireTaskLeaseFn;
    private readonly heartbeatTaskLeaseFn: HeartbeatTaskLeaseFn;
    private readonly releaseTaskLeaseFn: ReleaseTaskLeaseFn;
    private readonly assertTransitionFn: AssertTransitionFn;
    private readonly updatePlanStepStateFn?: UpdatePlanStepStateFn;

    constructor(options?: {
        retryManager?: RetryManager;
        taskModel?: TaskModelLike;
        toolRegistry?: ToolRegistry;
        taskSuccessRegistry?: TaskSuccessRegistry;
        internalBaseUrl?: string;
        getLatestExecutionTaskAction?: GetLatestExecutionTaskAction;
        persistentLoopEnabled?: boolean;
        workerId?: string;
        retrieveMemoryFn?: RetrieveMemoryFn;
        getTaskPlanFn?: GetTaskPlanFn;
        createOrRefreshTaskPlanFn?: CreateOrRefreshTaskPlanFn;
        generateAndStoreReflectionFn?: GenerateAndStoreReflectionFn;
        acquireTaskLeaseFn?: AcquireTaskLeaseFn;
        heartbeatTaskLeaseFn?: HeartbeatTaskLeaseFn;
        releaseTaskLeaseFn?: ReleaseTaskLeaseFn;
        assertTransitionFn?: AssertTransitionFn;
        updatePlanStepStateFn?: UpdatePlanStepStateFn;
    }) {
        this.retryManager = options?.retryManager ?? new RetryManager([1000, 2000, 5000]);
        this.taskModel = options?.taskModel ?? resolveTaskModel(taskModule);
        this.toolRegistry = options?.toolRegistry ?? this.createDefaultToolRegistry();
        this.taskSuccessRegistry = options?.taskSuccessRegistry ?? createDefaultTaskSuccessRegistry();
        this.internalBaseUrl = options?.internalBaseUrl ?? process.env.SOCKET_SERVER_URL ?? process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
        this.getLatestExecutionTaskAction = options?.getLatestExecutionTaskAction ?? resolveGetLatestExecutionTaskAction(taskRepo);
        this.persistentLoopEnabled = options?.persistentLoopEnabled ?? (process.env.TASK_AGENT_PERSISTENT_LOOP_ENABLED === "true");
        this.workerId = options?.workerId ?? process.env.TASK_WORKER_ID ?? `${process.pid}-agent-runner`;
        this.retrieveMemoryFn = options?.retrieveMemoryFn ?? retrieveMemory;
        this.getTaskPlanFn = options?.getTaskPlanFn ?? getTaskPlan;
        this.createOrRefreshTaskPlanFn = options?.createOrRefreshTaskPlanFn ?? createOrRefreshTaskPlan;
        this.generateAndStoreReflectionFn = options?.generateAndStoreReflectionFn ?? generateAndStoreReflection;
        this.acquireTaskLeaseFn = options?.acquireTaskLeaseFn ?? acquireTaskLease;
        this.heartbeatTaskLeaseFn = options?.heartbeatTaskLeaseFn ?? heartbeatTaskLease;
        this.releaseTaskLeaseFn = options?.releaseTaskLeaseFn ?? releaseTaskLease;
        this.assertTransitionFn = options?.assertTransitionFn ?? assertTransition;
        this.updatePlanStepStateFn = options?.updatePlanStepStateFn;
    }

    private createDefaultToolRegistry() {
        const registry = new ToolRegistry();
        registry.register(new SendEmailTool());
        registry.register(new ScheduleMeetingTool());
        registry.register(new CreateIssueTool());
        return registry;
    }

    private trimCheckpoints(checkpoints: TaskCheckpoint[]) {
        const cap = 200;
        return checkpoints.length <= cap ? checkpoints : checkpoints.slice(checkpoints.length - cap);
    }

    private trimExecutionResults(results: TaskExecutionHistory["results"]) {
        const cap = 100;
        return results.length <= cap ? results : results.slice(results.length - cap);
    }

    private getExecutionHistory(task: TaskDocumentLike): TaskExecutionHistory {
        return {
            attempts: typeof task.executionHistory?.attempts === "number" ? task.executionHistory.attempts : 0,
            failures: typeof task.executionHistory?.failures === "number" ? task.executionHistory.failures : 0,
            results: Array.isArray(task.executionHistory?.results) ? task.executionHistory.results : [],
        };
    }

    private async decideNextAction(
        task: TaskDocumentLike,
        executionHistory: TaskExecutionHistory,
        availableTools: AvailableToolForDecision[],
        iterationContext: IterationContextEntry[]
    ): Promise<NextActionDecision> {
        const apiKey = process.env.OPENAI_API_KEY;
        const fallbackTool = availableTools.find((tool) => tool.name === "send_email") ?? availableTools[0];

        if (!fallbackTool) {
            return {
                toolName: "none",
                toolInput: {},
                reasoning: "No available tools were registered.",
                goalAchieved: false,
            };
        }

        if (!apiKey) {
            return {
                toolName: fallbackTool.name,
                toolInput: this.getDefaultToolInput(fallbackTool.name, task),
                reasoning: "OPENAI_API_KEY is not configured; using fallback tool selection.",
                goalAchieved: false,
            };
        }

        const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
        const model = process.env.TASK_AGENT_MODEL || "gpt-4o-mini";

        const openAiTools = this.toolRegistry.listOpenAITools();

        const systemPrompt = [
            "You are an execution-first autonomous task agent.",
            "Decide the next best step using function/tool calling when action is needed.",
            "If no action is needed, respond with JSON in plain text with: noAction, goalAchieved, reasoning.",
            "If user input/state is insufficient, respond with JSON: needsClarification, clarificationQuestion, reasoning.",
            "When calling a tool, choose exactly one tool call with valid JSON arguments.",
        ].join(" ");

        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: "system" as const,
                        content: systemPrompt,
                    },
                    {
                        role: "user" as const,
                        content: JSON.stringify({
                            task: {
                                id: task._id.toString(),
                                title: task.title,
                                description: task.description,
                                status: task.status,
                                progress: typeof task.progress === "number" ? task.progress : 0,
                                result: task.result ?? null,
                            },
                            executionHistory,
                            availableTools,
                            iterationContext,
                        }),
                    },
                ],
                tools: openAiTools,
                tool_choice: "auto",
            }),
        });

        if (!response.ok) {
            return {
                toolName: fallbackTool.name,
                toolInput: this.getDefaultToolInput(fallbackTool.name, task),
                reasoning: `LLM request failed with status ${response.status}; using fallback tool.`,
                goalAchieved: false,
            };
        }

        try {
            const payload = await response.json();
            const message = payload?.choices?.[0]?.message;
            const toolCall = Array.isArray(message?.tool_calls) ? message.tool_calls[0] : null;

            if (toolCall?.function?.name) {
                const requestedTool = toolCall.function.name;
                const selectedTool = availableTools.find((tool) => tool.name === requestedTool) ?? fallbackTool;
                let parsedArguments: Record<string, unknown> = {};

                if (typeof toolCall.function.arguments === "string" && toolCall.function.arguments.trim().length > 0) {
                    try {
                        const raw = JSON.parse(toolCall.function.arguments) as unknown;
                        if (raw && typeof raw === "object") {
                            parsedArguments = raw as Record<string, unknown>;
                        }
                    } catch {
                        parsedArguments = {};
                    }
                }

                return {
                    toolName: selectedTool.name,
                    toolInput: parsedArguments,
                    reasoning: typeof message?.content === "string" ? message.content : undefined,
                    goalAchieved: false,
                };
            }

            const messageContent = typeof message?.content === "string"
                ? message.content
                : Array.isArray(message?.content)
                    ? message.content.map((entry: { text?: string }) => entry?.text ?? "").join("\n")
                    : "";

            if (messageContent.trim().length > 0) {
                try {
                    const parsedText = JSON.parse(messageContent) as Partial<NextActionDecision>;
                    return {
                        toolName: fallbackTool.name,
                        toolInput: this.getDefaultToolInput(fallbackTool.name, task),
                        reasoning: typeof parsedText.reasoning === "string" ? parsedText.reasoning : messageContent,
                        goalAchieved: Boolean(parsedText.goalAchieved),
                        noAction: Boolean(parsedText.noAction),
                        needsClarification: Boolean(parsedText.needsClarification),
                        clarificationQuestion: typeof parsedText.clarificationQuestion === "string" ? parsedText.clarificationQuestion : undefined,
                    };
                } catch {
                    const lowered = messageContent.toLowerCase();
                    const needsClarification = lowered.includes("clarif") || lowered.includes("more information");
                    const noAction = lowered.includes("no action");
                    return {
                        toolName: fallbackTool.name,
                        toolInput: this.getDefaultToolInput(fallbackTool.name, task),
                        reasoning: messageContent,
                        goalAchieved: noAction,
                        noAction,
                        needsClarification,
                        clarificationQuestion: needsClarification ? messageContent : undefined,
                    };
                }
            }

            return {
                toolName: fallbackTool.name,
                toolInput: this.getDefaultToolInput(fallbackTool.name, task),
                reasoning: "LLM returned no tool call or structured instruction; using fallback tool.",
                goalAchieved: false,
            };
        } catch {
            return {
                toolName: fallbackTool.name,
                toolInput: this.getDefaultToolInput(fallbackTool.name, task),
                reasoning: "LLM response parsing failed; using fallback tool.",
                goalAchieved: false,
            };
        }
    }

    private extractEmailFromText(text: string): string | null {
        const emailRegex = /([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
        const match = text.match(emailRegex);
        return match ? match[0] : null;
    }

    private generateEmailSubject(taskTitle: string): string {
        // Extract key words from task title, removing common phrases
        const cleaned = taskTitle
            .replace(/^(send an email to|report|notify|inform|alert|update|create|schedule)/gi, "")
            .replace(/to\s+\w+@[\w.]+/gi, "")
            .replace(/^\s+|\s+$/g, "")
            .trim();

        // If we have a cleaned title, use it; otherwise use the original
        if (cleaned.length > 5) {
            return cleaned.split(" ").slice(0, 8).join(" ");
        }

        // Fallback: extract first meaningful part
        const words = taskTitle.split(" ");
        return words.slice(0, 6).join(" ");
    }

    private generateEmailBody(taskTitle: string, taskDescription: string, taskId: string): string {
        const timestamp = new Date().toISOString();

        // Extract key action items from title and description
        const actionMatch = taskTitle.match(/to\s+(.+?)(?:\s+|$)/i);
        const action = actionMatch ? actionMatch[1] : taskTitle;

        return `
Task Notification

Task Title: ${taskTitle}

Details:
• Task ID: ${taskId}
• Created At: ${timestamp}
• Priority: High (Automated)

Description:
${taskDescription || "No additional details provided."}

Action Required:
Please review this task and take appropriate action.

---
This is an automated notification generated by the Task Execution System.
Reply to confirm receipt or contact support if you have questions.
`.trim();
    }

    private getDefaultToolInput(toolName: string, task: TaskDocumentLike): Record<string, unknown> {
        if (toolName === "send_email") {
            const recipientEmail = this.extractEmailFromText(task.title) || this.extractEmailFromText(task.description || "");
            const subject = this.generateEmailSubject(task.title);
            const body = this.generateEmailBody(task.title, task.description || "", task._id.toString());

            return {
                to: recipientEmail || process.env.RESEND_FROM_EMAIL || "noreply@task-execution.local",
                subject: subject.length > 0 ? subject : "Task Notification",
                body,
            };
        }
        if (toolName === "schedule_meeting") {
            return {
                summary: task.title,
                whenText: "tomorrow 10am",
            };
        }
        if (toolName === "create_github_issue") {
            return {
                title: task.title,
                body: `Task ID: ${task._id.toString()}\n\n${task.description || "No description provided"}`,
            };
        }
        return {};
    }

    private progressForStep(step: "execute" | "observe" | "verify" | "adjust" | "done" | "failed", status: "started" | "completed" | "failed") {
        if (step === "done" || step === "failed") return 100;
        if (step === "execute") return status === "completed" ? 35 : 15;
        if (step === "observe") return status === "completed" ? 55 : 45;
        if (step === "verify") return status === "completed" ? 75 : 70;
        if (step === "adjust") return status === "completed" ? 85 : 80;
        return 0;
    }

    private async appendCheckpoint(
        task: TaskDocumentLike,
        input: {
            step: "execute" | "observe" | "verify" | "adjust" | "done" | "failed";
            status: "started" | "completed" | "failed";
            progress?: number;
            historyDelta?: ExecutionHistoryDelta;
        }
    ) {
        const nextCheckpoints = this.trimCheckpoints([
            ...(task.checkpoints ?? []),
            {
                step: input.step,
                status: input.status,
                timestamp: new Date().toISOString(),
            },
        ]);

        const history = this.getExecutionHistory(task);
        const nextHistory: TaskExecutionHistory = {
            attempts: history.attempts,
            failures: history.failures,
            results: [...history.results],
        };

        if (input.historyDelta?.attempts) {
            nextHistory.attempts += input.historyDelta.attempts;
        }
        if (input.historyDelta?.failures) {
            nextHistory.failures += input.historyDelta.failures;
        }
        if (input.historyDelta?.appendResult) {
            nextHistory.results = this.trimExecutionResults([
                ...nextHistory.results,
                {
                    attempt: input.historyDelta.appendResult.attempt,
                    success: input.historyDelta.appendResult.success,
                    summary: input.historyDelta.appendResult.summary,
                    ...(input.historyDelta.appendResult.error ? { error: input.historyDelta.appendResult.error } : {}),
                    ...(input.historyDelta.appendResult.validationLog
                        ? { validationLog: input.historyDelta.appendResult.validationLog }
                        : {}),
                    timestamp: new Date().toISOString(),
                },
            ]);
        }

        await this.updateTask(task, {
            progress: typeof input.progress === "number" ? input.progress : this.progressForStep(input.step, input.status),
            checkpoints: nextCheckpoints,
            executionHistory: nextHistory,
        });
    }

    async runTask(taskId: string): Promise<RunTaskOutcome> {
        if (this.persistentLoopEnabled) {
            return this.runTaskPersistent(taskId);
        }

        const task = await this.taskModel.findById(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        const action = await this.getLatestExecutionTaskAction(taskId);
        if (!action) {
            throw new Error(`No execution action found for task: ${taskId}`);
        }

        const context: LoopContext = {
            task,
            action: {
                taskId: action.taskId.toString(),
                conversationId: action.conversationId.toString(),
                toolName: action.toolName ?? action.actionType,
                parameters: action.parameters ?? {},
                messageId: action.messageId ? action.messageId.toString() : null,
                executionState: action.executionState ?? null,
            },
            retryCount: typeof task.retryCount === "number" ? task.retryCount : 0,
            maxRetries: typeof task.maxRetries === "number" ? task.maxRetries : 2,
            attemptPayload: {
                taskId: action.taskId.toString(),
                conversationId: action.conversationId.toString(),
                toolName: action.toolName ?? action.actionType,
                parameters: action.parameters ?? {},
                messageId: action.messageId ? action.messageId.toString() : null,
                executionState: action.executionState ?? null,
            },
            observed: null,
            verification: null,
        };
        const availableTools = this.toolRegistry.listForLLM();
        const maxIterations = Math.max(1, Number(process.env.TASK_AGENT_MAX_ITERATIONS || 5));
        let iteration = 0;
        let goalAchieved = false;
        const iterationContext: IterationContextEntry[] = [];

        console.log("agent-runner lifecycle:start", {
            taskId,
            toolName: context.action.toolName,
            retryCount: context.retryCount,
            maxRetries: context.maxRetries,
            maxIterations,
        });

        await this.updateTask(task, {
            status: "executing",
            retryCount: context.retryCount,
            maxRetries: context.maxRetries,
        });

        while (!goalAchieved && iteration < maxIterations && task.status !== "completed") {
            iteration += 1;
            console.log("agent-runner lifecycle:loop", {
                taskId,
                iteration,
                maxIterations,
            });

            try {
                const decision = await this.decideNextAction(task, this.getExecutionHistory(task), availableTools, iterationContext);
                if (decision.needsClarification) {
                    await this.updateTask(task, {
                        status: "partial",
                        progress: 100,
                        result: {
                            success: false,
                            confidence: 0,
                            evidence: {
                                needsClarification: true,
                                clarificationQuestion: decision.clarificationQuestion ?? null,
                            },
                            error: decision.reasoning ?? "Execution paused: clarification required.",
                        },
                    });

                    await this.appendCheckpoint(task, {
                        step: "failed",
                        status: "completed",
                        progress: 100,
                    });

                    return {
                        completed: false,
                        retryCount: context.retryCount,
                        maxRetries: context.maxRetries,
                        result: context.observed,
                        verification: context.verification,
                    };
                }

                if (decision.noAction || decision.goalAchieved) {
                    goalAchieved = true;
                    await this.updateTask(task, {
                        status: "completed",
                        progress: 100,
                        result: {
                            success: true,
                            confidence: context.verification?.confidence ?? 1,
                            evidence: {
                                decision,
                                execution: context.observed?.evidence ?? null,
                            },
                        },
                    });

                    await this.appendCheckpoint(task, {
                        step: "done",
                        status: "completed",
                        progress: 100,
                    });

                    return {
                        completed: true,
                        retryCount: context.retryCount,
                        maxRetries: context.maxRetries,
                        result: context.observed,
                        verification: context.verification,
                    };
                }

                context.attemptPayload = {
                    ...context.attemptPayload,
                    toolName: decision.toolName,
                    parameters: decision.toolInput,
                };
                context.action = context.attemptPayload;

                if (decision.reasoning) {
                    console.log("agent-runner step:decide", {
                        taskId,
                        toolName: decision.toolName,
                        reasoning: decision.reasoning,
                    });
                }

                iterationContext.push({
                    iteration,
                    decision: {
                        toolName: decision.toolName,
                        reasoning: decision.reasoning,
                        noAction: decision.noAction,
                        needsClarification: decision.needsClarification,
                    },
                });

                await this.appendCheckpoint(task, {
                    step: "execute",
                    status: "started",
                    historyDelta: { attempts: 1 },
                });

                const executed = await this.execute(context.attemptPayload);

                await this.appendCheckpoint(task, {
                    step: "execute",
                    status: "completed",
                });

                await this.appendCheckpoint(task, {
                    step: "observe",
                    status: "started",
                });

                context.observed = await this.observe(context, executed);

                const currentContext = iterationContext[iterationContext.length - 1];
                if (currentContext) {
                    currentContext.result = {
                        summary: context.observed.summary,
                        adapterSuccess: context.observed.adapterSuccess,
                        error: context.observed.error,
                    };
                }

                await this.appendCheckpoint(task, {
                    step: "observe",
                    status: "completed",
                });

                await this.appendCheckpoint(task, {
                    step: "verify",
                    status: "started",
                });

                context.verification = await this.verify(context.observed, context);

                if (context.verification.success) {
                    await this.appendCheckpoint(task, {
                        step: "verify",
                        status: "completed",
                        historyDelta: {
                            appendResult: {
                                attempt: context.retryCount + 1,
                                success: true,
                                summary: context.observed.summary,
                                validationLog: context.verification.validationLog,
                            },
                        },
                    });
                } else {
                    await this.appendCheckpoint(task, {
                        step: "verify",
                        status: "failed",
                        historyDelta: {
                            failures: 1,
                            appendResult: {
                                attempt: context.retryCount + 1,
                                success: false,
                                summary: context.observed.summary,
                                error: context.observed.error ?? "Verification failed",
                                validationLog: context.verification.validationLog,
                            },
                        },
                    });
                }

                if (context.verification.success) {
                    await this.updateTask(task, {
                        status: "completed",
                        retryCount: context.retryCount,
                        maxRetries: context.maxRetries,
                        progress: 100,
                        result: {
                            success: true,
                            confidence: context.verification.confidence,
                            evidence: {
                                execution: context.observed.evidence,
                                validationLog: context.verification.validationLog,
                            },
                        },
                    });

                    await this.appendCheckpoint(task, {
                        step: "done",
                        status: "completed",
                        progress: 100,
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

                context.retryCount += 1;

                console.warn("agent-runner lifecycle:continue", {
                    taskId,
                    iteration,
                    reason: context.observed.error ?? "verification failed",
                });

                await this.updateTask(task, {
                    status: "executing",
                    retryCount: context.retryCount,
                    maxRetries: context.maxRetries,
                });
            } catch (error) {
                const reason = error instanceof Error ? error.message : "unknown execution error";

                await this.appendCheckpoint(task, {
                    step: "execute",
                    status: "failed",
                    historyDelta: {
                        failures: 1,
                        appendResult: {
                            attempt: context.retryCount + 1,
                            success: false,
                            summary: "Execution failed before verification",
                            error: reason,
                        },
                    },
                });

                context.observed = {
                    summary: "Execution failed before verification",
                    adapterSuccess: false,
                    evidence: {
                        reason,
                        iteration,
                    },
                    error: reason,
                };

                context.retryCount += 1;

                console.warn("agent-runner lifecycle:iteration-error", {
                    taskId,
                    reason,
                    retryCount: context.retryCount,
                    maxRetries: context.maxRetries,
                });

                await this.updateTask(task, {
                    status: "executing",
                    retryCount: context.retryCount,
                    maxRetries: context.maxRetries,
                });
            }
        }

        await this.updateTask(task, {
            status: "failed",
            retryCount: context.retryCount,
            maxRetries: context.maxRetries,
            progress: 100,
            result: {
                success: false,
                confidence: context.verification?.confidence ?? 0,
                evidence: context.observed?.evidence ?? null,
                error: "Max iterations reached before goal achievement.",
            },
        });

        await this.appendCheckpoint(task, {
            step: "failed",
            status: "completed",
            progress: 100,
        });

        console.log("agent-runner lifecycle:exhausted", {
            taskId,
            retryCount: context.retryCount,
            maxRetries: context.maxRetries,
            maxIterations,
        });

        return {
            completed: false,
            retryCount: context.retryCount,
            maxRetries: context.maxRetries,
            result: context.observed,
            verification: context.verification,
        };
    }

    private isTransientFailure(error?: string) {
        if (!error) return false;
        const lowered = error.toLowerCase();
        return lowered.includes("timeout")
            || lowered.includes("temporar")
            || lowered.includes("429")
            || lowered.includes("502")
            || lowered.includes("503")
            || lowered.includes("504")
            || lowered.includes("econn")
            || lowered.includes("network");
    }

    private async ensurePlan(task: TaskDocumentLike): Promise<TaskPlanLike> {
        let plan = await this.getTaskPlanFn(task._id.toString()) as unknown as TaskPlanLike | null;
        if (!plan) {
            await this.transitionLifecycle(task, "planning");
            await this.createOrRefreshTaskPlanFn({
                taskId: task._id.toString(),
                conversationId: task.conversationId.toString(),
                title: task.title,
                description: task.description,
                sourceMessageIds: (task.sourceMessageIds ?? []).map((id) => id.toString()),
                availableTools: this.toolRegistry.listForLLM().map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                })),
            });
            await this.transitionLifecycle(task, "ready");
            plan = await this.getTaskPlanFn(task._id.toString()) as unknown as TaskPlanLike | null;
        }

        if (!plan) {
            throw new Error(`Failed to load task plan for task: ${task._id.toString()}`);
        }

        return plan;
    }

    private async transitionLifecycle(
        task: TaskDocumentLike,
        nextState: "planning" | "ready" | "executing" | "waiting_for_approval" | "blocked" | "retry_scheduled" | "paused" | "completed" | "failed"
    ) {
        const current = task.lifecycleState ?? "ready";
        if (current === nextState) return;
        this.assertTransitionFn(current, nextState);

        task.lifecycleState = nextState;
        if (nextState === "completed") {
            task.status = "completed";
        } else if (nextState === "failed") {
            task.status = "failed";
        } else if (nextState === "executing") {
            task.status = "executing";
        } else if (nextState === "waiting_for_approval" || nextState === "blocked") {
            task.status = "partial";
        } else if (nextState === "ready") {
            task.status = "pending";
        }

        await this.updateTask(task, {
            status: task.status,
            lifecycleState: task.lifecycleState,
        });
    }

    private async pickNextRunnableStep(plan: TaskPlanLike): Promise<PlanStepLike | null> {
        const byId = new Map(plan.steps.map((step) => [step.stepId, step]));

        const runnable = plan.steps
            .filter((step) => step.state === "ready" || step.state === "retry_scheduled")
            .filter((step) => {
                if (step.overrideDependencies) {
                    return true;
                }

                if (!step.dependencies || step.dependencies.length === 0) {
                    return true;
                }

                if (step.fallbackPolicy === "immediate_execution") {
                    return step.dependencies.every((dependencyId) => {
                        const state = byId.get(dependencyId)?.state;
                        return state === "completed" || state === "failed" || state === "skipped";
                    });
                }

                return step.dependencies.every((dependencyId) => byId.get(dependencyId)?.state === "completed");
            })
            .sort((left, right) => left.order - right.order);

        return runnable[0] ?? null;
    }

    private async updatePlanStepState(taskId: string, stepId: string, patch: Partial<PlanStepLike>) {
        if (this.updatePlanStepStateFn) {
            await this.updatePlanStepStateFn(taskId, stepId, patch);
            return;
        }

        const setPatch: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(patch)) {
            setPatch[`steps.$.${key}`] = value as unknown;
        }

        await TaskPlanModel.updateOne(
            {
                taskId,
                "steps.stepId": stepId,
            },
            {
                $set: {
                    ...setPatch,
                    activeStepId: stepId,
                },
            }
        ).exec();
    }

    private rankStepTools(step: PlanStepLike, longTermMemory: Array<Record<string, unknown>>) {
        const historyByTool = new Map<string, number[]>();

        for (const item of longTermMemory) {
            const toolName = typeof item.toolName === "string" ? item.toolName : null;
            if (!toolName) continue;
            const impact = typeof item.successImpact === "number" ? item.successImpact : 0;
            const normalized = Math.max(0, Math.min(1, (impact + 1) / 2));
            const list = historyByTool.get(toolName) ?? [];
            list.push(normalized);
            historyByTool.set(toolName, list);
        }

        const candidates = step.toolCandidates.length > 0
            ? step.toolCandidates
            : this.toolRegistry.listForLLM().map((tool) => ({
                toolName: tool.name,
                confidence: 0.5,
                riskLevel: "medium" as const,
            }));

        const inputs: ToolRankingInput[] = candidates
            .filter((candidate) => candidate.toolName !== "none")
            .map((candidate) => {
                const history = historyByTool.get(candidate.toolName) ?? [];
                const historicalSuccessRate = history.length > 0
                    ? history.reduce((sum, value) => sum + value, 0) / history.length
                    : 0.5;

                return {
                    toolName: candidate.toolName as Exclude<TaskExecutionActionType, "none">,
                    capabilityScore: candidate.confidence,
                    historicalSuccessRate,
                    riskPenalty: candidate.riskLevel === "high" ? 0.7 : candidate.riskLevel === "medium" ? 0.35 : 0.1,
                    recentFailurePenalty: 0,
                };
            });

        return rankTools(inputs);
    }

    private async decideStepAction(input: {
        task: TaskDocumentLike;
        step: PlanStepLike;
        rankedTools: ReturnType<typeof rankTools>;
        shortTermMemory: Array<Record<string, unknown>>;
        longTermMemory: Array<Record<string, unknown>>;
        iteration: number;
    }): Promise<NextActionDecision> {
        const ranked = input.rankedTools;
        const fallbackTool = ranked[0]?.toolName ?? "send_email";

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return {
                toolName: fallbackTool,
                toolInput: this.getDefaultToolInput(fallbackTool, input.task),
                reasoning: "No API key configured. Using ranked fallback tool.",
            };
        }

        const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
        const model = process.env.TASK_AGENT_MODEL || "gpt-4o-mini";

        const openAiTools = this.toolRegistry.listOpenAITools().filter((entry) =>
            ranked.some((tool) => tool.toolName === entry.function.name)
        );

        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                temperature: 0.1,
                messages: [
                    {
                        role: "system" as const,
                        content: "You are a step-driven autonomous task agent. Pick exactly one tool call for the current step. Prefer higher ranked tools unless context strongly suggests otherwise.",
                    },
                    {
                        role: "user" as const,
                        content: JSON.stringify({
                            task: {
                                id: input.task._id.toString(),
                                title: input.task.title,
                                description: input.task.description,
                            },
                            currentStep: input.step,
                            rankedTools: ranked,
                            memory: {
                                shortTerm: input.shortTermMemory.slice(0, 5),
                                longTerm: input.longTermMemory.slice(0, 5),
                            },
                            iteration: input.iteration,
                        }),
                    },
                ],
                tools: openAiTools,
                tool_choice: "auto",
            }),
        });

        if (!response.ok) {
            return {
                toolName: fallbackTool,
                toolInput: this.getDefaultToolInput(fallbackTool, input.task),
                reasoning: `LLM request failed (${response.status}). Using ranked fallback tool.`,
            };
        }

        const payload = await response.json();
        const message = payload?.choices?.[0]?.message;
        const toolCall = Array.isArray(message?.tool_calls) ? message.tool_calls[0] : null;

        if (toolCall?.function?.name) {
            const toolName = ranked.some((tool) => tool.toolName === toolCall.function.name)
                ? toolCall.function.name
                : fallbackTool;
            let toolInput: Record<string, unknown> = {};
            if (typeof toolCall.function.arguments === "string" && toolCall.function.arguments.trim().length > 0) {
                try {
                    const parsed = JSON.parse(toolCall.function.arguments) as unknown;
                    if (parsed && typeof parsed === "object") {
                        toolInput = parsed as Record<string, unknown>;
                    }
                } catch {
                    toolInput = {};
                }
            }

            return {
                toolName,
                toolInput,
                reasoning: typeof message?.content === "string" ? message.content : undefined,
            };
        }

        return {
            toolName: fallbackTool,
            toolInput: this.getDefaultToolInput(fallbackTool, input.task),
            reasoning: "No valid tool call returned; using ranked fallback tool.",
        };
    }

    private async runTaskPersistent(taskId: string): Promise<RunTaskOutcome> {
        const task = await this.taskModel.findById(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        const lease = await this.acquireTaskLeaseFn(taskId, this.workerId);
        if (!lease) {
            return {
                completed: false,
                retryCount: typeof task.retryCount === "number" ? task.retryCount : 0,
                maxRetries: typeof task.maxRetries === "number" ? task.maxRetries : 2,
                result: null,
                verification: null,
            };
        }

        const maxIterations = Math.max(1, Number(process.env.TASK_AGENT_MAX_ITERATIONS || 8));
        let iteration = typeof task.iterationCount === "number" ? task.iterationCount : 0;
        let lastResult: ActionExecutionResult | null = null;
        let lastVerification: VerificationOutcome | null = null;

        try {
            await this.ensurePlan(task);
            await this.transitionLifecycle(task, "ready");

            while (iteration < maxIterations) {
                iteration += 1;
                await this.heartbeatTaskLeaseFn(taskId, this.workerId);

                const latestTask = await this.taskModel.findById(taskId);
                if (!latestTask) {
                    throw new Error(`Task disappeared during execution: ${taskId}`);
                }

                const plan = await this.ensurePlan(latestTask);
                const step = await this.pickNextRunnableStep(plan);

                if (!step) {
                    const hasFailedStep = plan.steps.some((entry) => entry.state === "failed" || entry.state === "blocked");
                    const hasPending = plan.steps.some((entry) => ["ready", "running", "retry_scheduled", "waiting_for_dependency"].includes(entry.state));

                    if (hasFailedStep) {
                        await this.transitionLifecycle(latestTask, "failed");
                        break;
                    }

                    if (!hasPending) {
                        await this.transitionLifecycle(latestTask, "completed");
                        break;
                    }

                    await this.transitionLifecycle(latestTask, "blocked");
                    latestTask.blockedReason = "No runnable steps due to dependency constraints.";
                    await this.updateTask(latestTask, {
                        status: latestTask.status,
                        lifecycleState: latestTask.lifecycleState,
                    });
                    break;
                }

                await this.transitionLifecycle(latestTask, "executing");
                await this.updateTask(latestTask, {
                    status: latestTask.status,
                    lifecycleState: latestTask.lifecycleState,
                    currentStepId: step.stepId,
                    iterationCount: iteration,
                });

                await this.updatePlanStepState(taskId, step.stepId, {
                    state: "running",
                    startedAt: new Date(),
                    attempts: (step.attempts ?? 0) + 1,
                    selectedToolName: step.selectedToolName ?? null,
                    lastError: null,
                });

                const memory = await this.retrieveMemoryFn({
                    taskId,
                    conversationId: latestTask.conversationId.toString(),
                    toolName: step.selectedToolName ?? undefined,
                    limit: 10,
                });

                const rankedTools = this.rankStepTools(step, memory.longTerm as Array<Record<string, unknown>>);

                const decision = await this.decideStepAction({
                    task: latestTask,
                    step,
                    rankedTools,
                    shortTermMemory: memory.shortTerm as Array<Record<string, unknown>>,
                    longTermMemory: memory.longTerm as Array<Record<string, unknown>>,
                    iteration,
                });

                const executionPayload: ExecutionActionRecord = {
                    taskId,
                    conversationId: latestTask.conversationId.toString(),
                    toolName: decision.toolName,
                    parameters: decision.toolInput,
                    messageId: null,
                    executionState: "running",
                };

                const executed = await this.execute(executionPayload);
                lastResult = await this.observe({
                    task: latestTask,
                    action: executionPayload,
                    retryCount: typeof latestTask.retryCount === "number" ? latestTask.retryCount : 0,
                    maxRetries: typeof latestTask.maxRetries === "number" ? latestTask.maxRetries : 2,
                    attemptPayload: executionPayload,
                    observed: executed,
                    verification: null,
                }, executed);

                lastVerification = await this.verify(lastResult, {
                    task: latestTask,
                    action: executionPayload,
                    retryCount: typeof latestTask.retryCount === "number" ? latestTask.retryCount : 0,
                    maxRetries: typeof latestTask.maxRetries === "number" ? latestTask.maxRetries : 2,
                    attemptPayload: executionPayload,
                    observed: lastResult,
                    verification: null,
                });

                if (lastVerification.success) {
                    await this.updatePlanStepState(taskId, step.stepId, {
                        state: "completed",
                        completedAt: new Date(),
                        selectedToolName: decision.toolName,
                        output: {
                            summary: lastResult.summary,
                            evidence: lastResult.evidence,
                            confidence: lastVerification.confidence,
                        },
                    });
                    continue;
                }

                const transient = this.isTransientFailure(lastResult.error);
                const attempted = (step.attempts ?? 0) + 1;

                if (transient && attempted < (step.maxAttempts ?? 3)) {
                    await this.updatePlanStepState(taskId, step.stepId, {
                        state: "retry_scheduled",
                        selectedToolName: decision.toolName,
                        lastError: lastResult.error ?? "Transient failure",
                    });

                    await this.transitionLifecycle(latestTask, "retry_scheduled");
                    await wait(this.getBackoffDelay(attempted));
                    await this.transitionLifecycle(latestTask, "ready");
                    continue;
                }

                const fallbackStepId = step.fallback[0]?.stepId;
                if (fallbackStepId) {
                    await this.updatePlanStepState(taskId, step.stepId, {
                        state: "failed",
                        selectedToolName: decision.toolName,
                        lastError: lastResult.error ?? "Verification failed",
                    });

                    const fallbackStep = plan.steps.find((entry) => entry.stepId === fallbackStepId) ?? null;
                    if (fallbackStep) {
                        await this.appendCheckpoint(latestTask, {
                            step: "adjust",
                            status: "started",
                        });

                        await this.updatePlanStepState(taskId, fallbackStepId, {
                            state: "ready",
                            // Immediate fallback ignores failed dependency constraints by design.
                            overrideDependencies: fallbackStep.fallbackPolicy === "immediate_execution"
                                ? true
                                : fallbackStep.overrideDependencies,
                        });

                        await this.appendCheckpoint(latestTask, {
                            step: "adjust",
                            status: "completed",
                        });
                    }

                    await this.transitionLifecycle(latestTask, "ready");
                    continue;
                }

                await this.updatePlanStepState(taskId, step.stepId, {
                    state: "failed",
                    selectedToolName: decision.toolName,
                    lastError: lastResult.error ?? "Verification failed",
                    output: {
                        summary: lastResult.summary,
                        evidence: lastResult.evidence,
                        confidence: lastVerification.confidence,
                    },
                });

                await this.transitionLifecycle(latestTask, "failed");
                await this.appendCheckpoint(latestTask, {
                    step: "adjust",
                    status: "failed",
                });
                break;
            }

            const finalTask = await this.taskModel.findById(taskId);
            if (!finalTask) {
                throw new Error(`Task disappeared before finalization: ${taskId}`);
            }

            const outcome = (finalTask.lifecycleState ?? "ready") === "completed";
            await this.generateAndStoreReflectionFn({
                taskId,
                conversationId: finalTask.conversationId.toString(),
                runId: null,
                title: finalTask.title,
                outcome: outcome ? "completed" : (finalTask.lifecycleState === "failed" ? "failed" : "partial"),
                executionSummary: lastResult?.summary ?? (outcome ? "Task completed." : "Task failed."),
                toolName: lastResult && typeof (lastResult.evidence as Record<string, unknown>)?.toolName === "string"
                    ? (lastResult.evidence as Record<string, unknown>).toolName as string
                    : null,
            });

            return {
                completed: outcome,
                retryCount: typeof finalTask.retryCount === "number" ? finalTask.retryCount : 0,
                maxRetries: typeof finalTask.maxRetries === "number" ? finalTask.maxRetries : 2,
                result: lastResult,
                verification: lastVerification,
            };
        } finally {
            await this.releaseTaskLeaseFn(taskId, this.workerId);
        }
    }

    private async observe(_context: LoopContext, result: ActionExecutionResult): Promise<ActionExecutionResult> {
        console.log("agent-runner step:observe", {
            summary: result.summary,
            adapterSuccess: result.adapterSuccess,
        });

        return result;
    }

    private async execute(payload: ExecutionActionRecord): Promise<ActionExecutionResult> {
        const tool = this.toolRegistry.get(payload.toolName);

        console.log("agent-runner step:execute", {
            taskId: payload.taskId,
            toolName: payload.toolName,
            parameters: payload.parameters,
        });

        if (!tool) {
            return {
                summary: `No tool registered for name ${payload.toolName}.`,
                adapterSuccess: false,
                evidence: { toolName: payload.toolName },
                error: `No tool registered for name ${payload.toolName}`,
            };
        }

        try {
            const parsedInput = tool.inputSchema.parse(payload.parameters ?? {});
            const result = await tool.execute(parsedInput, {
                taskId: payload.taskId,
                conversationId: payload.conversationId,
                messageId: payload.messageId,
            });

            console.log("agent-runner step:tool-execute", {
                taskId: payload.taskId,
                toolName: tool.name,
                success: result.adapterSuccess,
            });

            return {
                ...result,
                evidence: {
                    toolName: tool.name,
                    result: result.evidence,
                },
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : "unknown tool error";
            console.warn("agent-runner step:tool-failure", {
                taskId: payload.taskId,
                toolName: tool.name,
                reason: message,
            });

            return {
                summary: `Tool ${tool.name} failed.`,
                adapterSuccess: false,
                evidence: {
                    toolName: tool.name,
                    reason: message,
                },
                error: message,
            };
        }
    }

    private async verify(result: ActionExecutionResult, context: LoopContext): Promise<VerificationOutcome> {
        const validationLog = this.taskSuccessRegistry.validate(context.action.toolName as TaskExecutionActionType, context.task, result);
        const passedChecks = validationLog.checks.filter((check) => check.passed).length;
        const totalChecks = validationLog.checks.length;
        const confidence = totalChecks > 0 ? passedChecks / totalChecks : (validationLog.passed ? 1 : 0);

        console.log("agent-runner step:verify", {
            toolName: context.action.toolName,
            evidence: result.evidence,
            validator: validationLog.validator,
            passed: validationLog.passed,
            checks: validationLog.checks,
        });

        return {
            success: validationLog.passed,
            confidence,
            validationLog,
        };
    }

    private async adjust(context: LoopContext, result: ActionExecutionResult | null, verification: VerificationOutcome): Promise<ExecutionActionRecord> {
        const nextParameters = { ...(context.attemptPayload.parameters ?? {}) };

        if (context.action.toolName === "send_email") {
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

        if (context.action.toolName === "schedule_meeting") {
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

        if (context.action.toolName === "create_github_issue") {
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
            toolName: context.action.toolName,
            retryCount: context.retryCount,
            verificationConfidence: verification.confidence,
            adjustedParameters: nextParameters,
            previousSummary: result?.summary ?? null,
        });

        return adjusted;
    }

    private getBackoffDelay(retryCount: number) {
        const schedule = [1000, 2000, 5000] as const;
        return schedule[Math.min(Math.max(retryCount - 1, 0), schedule.length - 1)] ?? 0;
    }

    private async updateTask(task: TaskDocumentLike, patch: {
        status?: string;
        lifecycleState?: "planning" | "ready" | "executing" | "waiting_for_approval" | "blocked" | "retry_scheduled" | "paused" | "completed" | "failed";
        retryCount?: number;
        maxRetries?: number;
        currentStepId?: string | null;
        iterationCount?: number;
        progress?: number;
        checkpoints?: TaskCheckpoint[];
        executionHistory?: TaskExecutionHistory;
        result?: TaskResult;
    }) {
        const previousVersion = task.version;
        let changed = false;

        if (patch.status !== undefined && task.status !== patch.status) {
            task.status = patch.status;
            changed = true;
        }
        if (patch.lifecycleState !== undefined && task.lifecycleState !== patch.lifecycleState) {
            task.lifecycleState = patch.lifecycleState;
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
        if (patch.currentStepId !== undefined && task.currentStepId !== patch.currentStepId) {
            task.currentStepId = patch.currentStepId;
            changed = true;
        }
        if (patch.iterationCount !== undefined && task.iterationCount !== patch.iterationCount) {
            task.iterationCount = patch.iterationCount;
            changed = true;
        }
        if (patch.progress !== undefined && task.progress !== patch.progress) {
            task.progress = patch.progress;
            changed = true;
        }
        if (patch.checkpoints !== undefined && JSON.stringify(task.checkpoints ?? []) !== JSON.stringify(patch.checkpoints)) {
            task.checkpoints = patch.checkpoints;
            changed = true;
        }
        if (patch.executionHistory !== undefined && JSON.stringify(task.executionHistory ?? null) !== JSON.stringify(patch.executionHistory)) {
            task.executionHistory = patch.executionHistory;
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
                ...(patch.lifecycleState !== undefined ? { lifecycleState: patch.lifecycleState as any } : {}),
                ...(patch.retryCount !== undefined ? { retryCount: patch.retryCount } : {}),
                ...(patch.maxRetries !== undefined ? { maxRetries: patch.maxRetries } : {}),
                ...(patch.currentStepId !== undefined ? { currentStepId: patch.currentStepId } : {}),
                ...(patch.iterationCount !== undefined ? { iterationCount: patch.iterationCount } : {}),
                ...(patch.progress !== undefined ? { progress: patch.progress } : {}),
                ...(patch.checkpoints !== undefined ? { checkpoints: patch.checkpoints } : {}),
                ...(patch.executionHistory !== undefined ? { executionHistory: patch.executionHistory } : {}),
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
