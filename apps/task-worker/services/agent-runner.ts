import type { TaskCheckpoint, TaskExecutionActionType, TaskExecutionHistory, TaskResult, TaskUpdatedPayload, TaskValidationLog } from "@chat/types";
import { RetryManager } from "./retry-manager.js";
import * as taskPlannerModule from "@chat/services/task-planner.service";
import * as taskRepo from "@chat/services/repositories/task.repo";
import * as taskModule from "@chat/db/models/Task";
import ToolRegistry, { type ToolExecutionTask, type ToolResult } from "./tools/tool-registry.js";
import TaskSuccessRegistry, { createDefaultTaskSuccessRegistry } from "./task-success-registry.js";
import { CreateIssueTool } from "./tools/create-issue.tool.js";
import { ScheduleMeetingTool } from "./tools/schedule-meeting.tool.js";
import { SendEmailTool } from "./tools/send-email.tool.js";

const INTERNAL_SECRET_HEADER = "x-internal-secret";

type TaskModelLike = {
    findById: (id: string) => Promise<TaskDocumentLike | null>;
};

type TaskPlannerLike = {
    planTask: (taskId: string) => Promise<{ parentTaskId: string; subTaskIds: string[]; planned: boolean }>;
    getSubTasks: (parentTaskId: string) => Promise<Array<{ _id: { toString(): string }; status: string }>>;
    getNextExecutableTasks: (parentTaskId: string) => Promise<Array<{ _id: { toString(): string }; status: string }>>;
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
    parentTaskId?: { toString(): string } | null;
    title: string;
    description: string;
    status: string;
    subTasks?: Array<{ toString(): string }>;
    dependencyIds?: Array<{ toString(): string }>;
    retryCount?: number;
    maxRetries?: number;
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

function resolveTaskPlannerConstructor(moduleNs: unknown): new () => TaskPlannerLike {
    const asRecord = moduleNs as Record<string, unknown>;
    const defaultExport = asRecord?.default as Record<string, unknown> | undefined;
    const candidates: unknown[] = [
        asRecord?.TaskPlanner,
        defaultExport?.TaskPlanner,
        defaultExport,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "function") {
            return candidate as new () => TaskPlannerLike;
        }
    }

    throw new Error(`Task planner exports are invalid. keys=${Object.keys(asRecord || {}).join(",")}`);
}

function resolveGetLatestExecutionTaskAction(
    moduleNs: unknown
): (taskId: string) => Promise<{ taskId: { toString(): string }; conversationId: { toString(): string }; actionType: string; parameters?: Record<string, unknown> | null; messageId?: { toString(): string } | null; executionState?: string | null } | null> {
    const asRecord = moduleNs as Record<string, unknown>;
    const defaultExport = asRecord?.default as Record<string, unknown> | undefined;
    const candidates: unknown[] = [
        asRecord?.getLatestExecutionTaskAction,
        defaultExport?.getLatestExecutionTaskAction,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "function") {
            return candidate as (taskId: string) => Promise<{ taskId: { toString(): string }; conversationId: { toString(): string }; actionType: string; parameters?: Record<string, unknown> | null; messageId?: { toString(): string } | null; executionState?: string | null } | null>;
        }
    }

    throw new Error(`Task repository exports are invalid. keys=${Object.keys(asRecord || {}).join(",")}`);
}

export class AgentRunner {
    private readonly retryManager: RetryManager;
    private readonly taskModel: TaskModelLike;
    private readonly taskPlanner: TaskPlannerLike;
    private readonly toolRegistry: ToolRegistry;
    private readonly taskSuccessRegistry: TaskSuccessRegistry;
    private readonly internalBaseUrl: string;

    constructor(options?: {
        retryManager?: RetryManager;
        taskModel?: TaskModelLike;
        toolRegistry?: ToolRegistry;
        taskSuccessRegistry?: TaskSuccessRegistry;
        internalBaseUrl?: string;
    }) {
        this.retryManager = options?.retryManager ?? new RetryManager([1000, 2000, 5000]);
        this.taskModel = options?.taskModel ?? resolveTaskModel(taskModule);
        const TaskPlannerCtor = resolveTaskPlannerConstructor(taskPlannerModule);
        this.taskPlanner = new TaskPlannerCtor();
        this.toolRegistry = options?.toolRegistry ?? this.createDefaultToolRegistry();
        this.taskSuccessRegistry = options?.taskSuccessRegistry ?? createDefaultTaskSuccessRegistry();
        this.internalBaseUrl = options?.internalBaseUrl ?? process.env.SOCKET_SERVER_URL ?? process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
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

    private resolveResumeStep(task: TaskDocumentLike): "execute" | "adjust" {
        const checkpoints = task.checkpoints ?? [];
        if (checkpoints.length === 0) {
            return "execute";
        }

        const last = checkpoints[checkpoints.length - 1];
        if (last.step === "verify" && last.status === "failed") {
            return "adjust";
        }
        if (last.step === "adjust" && (last.status === "started" || last.status === "completed")) {
            return "adjust";
        }

        return "execute";
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
        const task = await this.taskModel.findById(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        const plan = await this.taskPlanner.planTask(taskId);
        if (plan.planned || (task.subTasks?.length ?? 0) > 0) {
            return this.runPlannedTask(taskId);
        }

        const getLatestExecutionTaskAction = resolveGetLatestExecutionTaskAction(taskRepo);
        const action = await getLatestExecutionTaskAction(taskId);
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

        let resumeStep = this.resolveResumeStep(task);

        console.log("agent-runner lifecycle:start", {
            taskId,
            actionType: context.action.actionType,
            retryCount: context.retryCount,
            maxRetries: context.maxRetries,
            resumeStep,
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
                if (resumeStep === "adjust") {
                    await this.appendCheckpoint(task, {
                        step: "adjust",
                        status: "started",
                    });

                    const resumedAdjustment = await this.adjust(
                        context,
                        context.observed,
                        context.verification ?? { success: false, confidence: 0 }
                    );
                    context.attemptPayload = resumedAdjustment;

                    await this.appendCheckpoint(task, {
                        step: "adjust",
                        status: "completed",
                    });

                    resumeStep = "execute";
                }

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

                if (context.retryCount >= context.maxRetries - 1) {
                    await this.updateTask(task, {
                        status: "failed",
                        retryCount: context.retryCount + 1,
                        maxRetries: context.maxRetries,
                        result: {
                            success: false,
                            confidence: context.verification.confidence,
                            evidence: {
                                execution: context.observed.evidence,
                                validationLog: context.verification.validationLog,
                            },
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

                await this.appendCheckpoint(task, {
                    step: "adjust",
                    status: "started",
                });

                const adjusted = await this.adjust(context, context.observed, context.verification);

                await this.appendCheckpoint(task, {
                    step: "adjust",
                    status: "completed",
                });

                context.attemptPayload = adjusted;
                context.retryCount += 1;
                resumeStep = "execute";

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

                if (context.retryCount >= context.maxRetries - 1) {
                    await this.updateTask(task, {
                        status: "failed",
                        retryCount: context.retryCount + 1,
                        maxRetries: context.maxRetries,
                        progress: 100,
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

                    await this.appendCheckpoint(task, {
                        step: "failed",
                        status: "completed",
                        progress: 100,
                    });

                    console.error("agent-runner lifecycle:terminal-failure", {
                        taskId,
                        reason,
                        retryCount: context.retryCount + 1,
                        maxRetries: context.maxRetries,
                    });
                    throw error;
                }

                await this.appendCheckpoint(task, {
                    step: "adjust",
                    status: "started",
                });

                const adjusted = await this.adjust(context, context.observed, { success: false, confidence: 0 });

                await this.appendCheckpoint(task, {
                    step: "adjust",
                    status: "completed",
                });

                context.attemptPayload = adjusted;
                context.retryCount += 1;
                resumeStep = "execute";

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
            progress: 100,
            result: {
                success: false,
                confidence: context.verification?.confidence ?? 0,
                evidence: context.observed?.evidence ?? null,
                error: "Retries exhausted.",
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
        });

        return {
            completed: false,
            retryCount: context.retryCount,
            maxRetries: context.maxRetries,
            result: context.observed,
            verification: context.verification,
        };
    }

    private async runPlannedTask(taskId: string): Promise<RunTaskOutcome> {
        const rootTask = await this.taskModel.findById(taskId);
        if (!rootTask) {
            throw new Error(`Task not found: ${taskId}`);
        }

        const subTaskIds = await this.taskPlanner.getSubTasks(taskId);
        console.log("agent-runner lifecycle:planned", {
            taskId,
            subTaskCount: subTaskIds.length,
        });

        await this.updateTask(rootTask, {
            status: "executing",
            retryCount: typeof rootTask.retryCount === "number" ? rootTask.retryCount : 0,
            maxRetries: typeof rootTask.maxRetries === "number" ? rootTask.maxRetries : 2,
        });

        let anyChildSucceeded = false;

        while (true) {
            const nextExecutableTasks = await this.taskPlanner.getNextExecutableTasks(taskId);

            if (nextExecutableTasks.length === 0) {
                const allChildren = await this.taskPlanner.getSubTasks(taskId);
                const allCompleted = allChildren.length > 0 && allChildren.every((child) => child.status === "completed");

                if (allCompleted) {
                    await this.updateTask(rootTask, {
                        status: "completed",
                        progress: 100,
                        result: {
                            success: true,
                            confidence: 1,
                            evidence: {
                                parentTaskId: taskId,
                                subTaskIds: allChildren.map((child) => child._id.toString()),
                            },
                        },
                    });

                    console.log("agent-runner lifecycle:parent-completed", {
                        taskId,
                        subTaskCount: allChildren.length,
                    });

                    return {
                        completed: true,
                        retryCount: typeof rootTask.retryCount === "number" ? rootTask.retryCount : 0,
                        maxRetries: typeof rootTask.maxRetries === "number" ? rootTask.maxRetries : 2,
                        result: null,
                        verification: { success: true, confidence: 1 },
                    };
                }

                const nextStatus = anyChildSucceeded ? "partial" : "failed";
                await this.updateTask(rootTask, {
                    status: nextStatus,
                    progress: 100,
                    result: {
                        success: false,
                        confidence: anyChildSucceeded ? 0.5 : 0,
                        evidence: {
                            parentTaskId: taskId,
                            subTaskIds: allChildren.map((child) => ({
                                taskId: child._id.toString(),
                                status: child.status,
                            })),
                        },
                        error: "Planned task chain did not complete successfully.",
                    },
                });

                console.warn("agent-runner lifecycle:parent-incomplete", {
                    taskId,
                    nextStatus,
                });

                return {
                    completed: false,
                    retryCount: typeof rootTask.retryCount === "number" ? rootTask.retryCount : 0,
                    maxRetries: typeof rootTask.maxRetries === "number" ? rootTask.maxRetries : 2,
                    result: null,
                    verification: { success: false, confidence: anyChildSucceeded ? 0.5 : 0 },
                };
            }

            for (const readyTask of nextExecutableTasks) {
                const childOutcome = await this.runTask(readyTask._id.toString());
                anyChildSucceeded = anyChildSucceeded || Boolean(childOutcome.completed);

                if (!childOutcome.completed) {
                    const updatedChildren = await this.taskPlanner.getSubTasks(taskId);
                    const nextStatus = anyChildSucceeded ? "partial" : "failed";

                    await this.updateTask(rootTask, {
                        status: nextStatus,
                        progress: 100,
                        result: {
                            success: false,
                            confidence: childOutcome.verification?.confidence ?? 0,
                            evidence: {
                                parentTaskId: taskId,
                                failedSubTaskId: readyTask._id.toString(),
                                subTaskStates: updatedChildren.map((child) => ({
                                    taskId: child._id.toString(),
                                    status: child.status,
                                })),
                            },
                            error: "A subtask failed before the parent task completed.",
                        },
                    });

                    console.log("agent-runner lifecycle:parent-stopped", {
                        taskId,
                        failedSubTaskId: readyTask._id.toString(),
                        nextStatus,
                    });

                    return {
                        completed: false,
                        retryCount: typeof rootTask.retryCount === "number" ? rootTask.retryCount : 0,
                        maxRetries: typeof rootTask.maxRetries === "number" ? rootTask.maxRetries : 2,
                        result: null,
                        verification: { success: false, confidence: childOutcome.verification?.confidence ?? 0 },
                    };
                }
            }
        }
    }

    private capabilityForActionType(actionType: TaskExecutionActionType) {
        switch (actionType) {
            case "send_email":
                return "send_email";
            case "schedule_meeting":
                return "schedule_meeting";
            case "create_github_issue":
                return "create_issue";
            case "none":
            default:
                return "none";
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
        const capability = this.capabilityForActionType(payload.actionType);
        const tools = this.toolRegistry.findToolsByCapability(capability);

        console.log("agent-runner step:execute", {
            taskId: payload.taskId,
            actionType: payload.actionType,
            capability,
            toolCount: tools.length,
            parameters: payload.parameters,
        });

        if (tools.length === 0) {
            return {
                summary: `No tool registered for capability ${capability}.`,
                adapterSuccess: false,
                evidence: { actionType: payload.actionType, capability },
                error: `No tool registered for capability ${capability}`,
            };
        }

        const executionTask: ToolExecutionTask = {
            taskId: payload.taskId,
            conversationId: payload.conversationId,
            capability,
            actionType: payload.actionType,
            parameters: payload.parameters,
            messageId: payload.messageId,
        };

        let lastFailure: ToolResult | null = null;

        for (const tool of tools) {
            try {
                const result = await tool.execute(executionTask);
                console.log("agent-runner step:tool-execute", {
                    taskId: payload.taskId,
                    capability,
                    toolName: tool.name,
                    success: result.adapterSuccess,
                });

                if (result.adapterSuccess) {
                    return {
                        ...result,
                        evidence: {
                            toolName: tool.name,
                            capability,
                            result: result.evidence,
                        },
                    };
                }

                lastFailure = result;
            } catch (error) {
                const message = error instanceof Error ? error.message : "unknown tool error";
                lastFailure = {
                    summary: `Tool ${tool.name} failed.`,
                    adapterSuccess: false,
                    evidence: {
                        toolName: tool.name,
                        capability,
                        reason: message,
                    },
                    error: message,
                };

                console.warn("agent-runner step:tool-failure", {
                    taskId: payload.taskId,
                    capability,
                    toolName: tool.name,
                    reason: message,
                });
            }
        }

        return {
            summary: lastFailure?.summary ?? `All tools failed for capability ${capability}.`,
            adapterSuccess: false,
            evidence: {
                capability,
                toolCount: tools.length,
                lastFailure: lastFailure?.evidence ?? null,
            },
            error: lastFailure?.error ?? `All tools failed for capability ${capability}`,
        };
    }

    private async verify(result: ActionExecutionResult, context: LoopContext): Promise<VerificationOutcome> {
        const validationLog = this.taskSuccessRegistry.validate(context.action.actionType, context.task, result);
        const passedChecks = validationLog.checks.filter((check) => check.passed).length;
        const totalChecks = validationLog.checks.length;
        const confidence = totalChecks > 0 ? passedChecks / totalChecks : (validationLog.passed ? 1 : 0);

        console.log("agent-runner step:verify", {
            actionType: context.action.actionType,
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

    private getBackoffDelay(retryCount: number) {
        const schedule = [1000, 2000, 5000] as const;
        return schedule[Math.min(Math.max(retryCount - 1, 0), schedule.length - 1)] ?? 0;
    }

    private async updateTask(task: TaskDocumentLike, patch: {
        status?: string;
        retryCount?: number;
        maxRetries?: number;
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
        if (patch.retryCount !== undefined && task.retryCount !== patch.retryCount) {
            task.retryCount = patch.retryCount;
            changed = true;
        }
        if (patch.maxRetries !== undefined && task.maxRetries !== patch.maxRetries) {
            task.maxRetries = patch.maxRetries;
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
                ...(patch.retryCount !== undefined ? { retryCount: patch.retryCount } : {}),
                ...(patch.maxRetries !== undefined ? { maxRetries: patch.maxRetries } : {}),
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
