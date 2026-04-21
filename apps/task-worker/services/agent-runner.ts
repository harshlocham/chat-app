import type { TaskCheckpoint, TaskExecutionActionType, TaskExecutionHistory, TaskResult, TaskUpdatedPayload, TaskValidationLog } from "@chat/types";
import { RetryManager } from "./retry-manager.js";
import * as taskRepo from "@chat/services/repositories/task.repo";
import * as taskModule from "@chat/db/models/Task";
import ToolRegistry from "./tools/tool-registry.js";
import TaskSuccessRegistry, { createDefaultTaskSuccessRegistry } from "./task-success-registry.js";
import { CreateIssueTool } from "./tools/create-issue.tool.js";
import { ScheduleMeetingTool } from "./tools/schedule-meeting.tool.js";
import { SendEmailTool } from "./tools/send-email.tool.js";

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
): (taskId: string) => Promise<{ taskId: { toString(): string }; conversationId: { toString(): string }; actionType: string; toolName?: string | null; parameters?: Record<string, unknown> | null; messageId?: { toString(): string } | null; executionState?: string | null } | null> {
    const asRecord = moduleNs as Record<string, unknown>;
    const defaultExport = asRecord?.default as Record<string, unknown> | undefined;
    const candidates: unknown[] = [
        asRecord?.getLatestExecutionTaskAction,
        defaultExport?.getLatestExecutionTaskAction,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "function") {
            return candidate as (taskId: string) => Promise<{ taskId: { toString(): string }; conversationId: { toString(): string }; actionType: string; toolName?: string | null; parameters?: Record<string, unknown> | null; messageId?: { toString(): string } | null; executionState?: string | null } | null>;
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

    constructor(options?: {
        retryManager?: RetryManager;
        taskModel?: TaskModelLike;
        toolRegistry?: ToolRegistry;
        taskSuccessRegistry?: TaskSuccessRegistry;
        internalBaseUrl?: string;
    }) {
        this.retryManager = options?.retryManager ?? new RetryManager([1000, 2000, 5000]);
        this.taskModel = options?.taskModel ?? resolveTaskModel(taskModule);
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
                toolInput: {},
                reasoning: "OPENAI_API_KEY is not configured; using fallback tool selection.",
                goalAchieved: false,
            };
        }

        const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
        const model = process.env.TASK_AGENT_MODEL || "gpt-4.1-mini";

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
                toolInput: {},
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
                        toolInput: {},
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
                        toolInput: {},
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
                toolInput: {},
                reasoning: "LLM returned no tool call or structured instruction; using fallback tool.",
                goalAchieved: false,
            };
        } catch {
            return {
                toolName: fallbackTool.name,
                toolInput: {},
                reasoning: "LLM response parsing failed; using fallback tool.",
                goalAchieved: false,
            };
        }
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
