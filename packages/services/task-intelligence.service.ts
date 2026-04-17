import type {
    MessageSemanticType,
    MessageSemanticUpdatedPayload,
    TaskExecutionActionType,
    TaskCreatedPayload,
    TaskLinkedToMessagePayload,
    TaskUpdatedPayload,
} from "@chat/types";
import MessageModel from "@/models/Message";
import TaskModel from "@/models/Task";
import {
    buildTaskActionIdempotencyKey,
    createTaskAction,
    deriveTaskDedupeKey,
    linkMessageToTask,
    upsertTaskByDedupeKey,
    updateMessageSemanticState,
} from "@/lib/repositories/task.repo";
import { connectToDatabase } from "@/lib/Db/db";
import { enqueueOutboxEvent } from "@/lib/services/outbox.service";

const AI_VERSION = "heuristic-v1";

const TASK_TERMS = [
    "fix",
    "deploy",
    "review",
    "ship",
    "implement",
    "create",
    "update",
    "write",
    "investigate",
    "test",
    "refactor",
    "prepare",
    "assign",
    "please",
    "todo",
];

const DECISION_TERMS = ["decided", "decision", "approved", "go with", "choose", "selected"];
const REMINDER_TERMS = ["remind", "reminder", "by tomorrow", "deadline", "due", "eod", "today"];

interface ClassificationResult {
    semanticType: MessageSemanticType;
    confidence: number;
}

interface TaskExecutionDecision {
    actionType: TaskExecutionActionType;
    parameters: Record<string, unknown>;
    confidence: number;
    needsApproval: boolean;
}

interface IntelligenceDecision {
    classification: ClassificationResult;
    execution: TaskExecutionDecision;
}

export interface ProcessMessageTaskIntelligenceInput {
    messageId: string;
    conversationId: string;
    senderId: string;
    content: string;
    messageType: string;
}

export interface ProcessMessageTaskIntelligenceResult {
    semanticPayload: MessageSemanticUpdatedPayload;
    taskCreatedPayload?: TaskCreatedPayload;
    taskUpdatedPayload?: TaskUpdatedPayload;
    taskLinkedPayload?: TaskLinkedToMessagePayload;
}

function normalizeContent(content: string) {
    return content.trim().replace(/\s+/g, " ");
}

function classifyMessage(content: string): ClassificationResult {
    const normalized = normalizeContent(content).toLowerCase();
    if (!normalized) {
        return { semanticType: "unknown", confidence: 0 };
    }

    const hasTaskTerm = TASK_TERMS.some((term) => normalized.includes(term));
    const hasDecisionTerm = DECISION_TERMS.some((term) => normalized.includes(term));
    const hasReminderTerm = REMINDER_TERMS.some((term) => normalized.includes(term));

    if (hasTaskTerm) {
        return { semanticType: "task", confidence: 0.82 };
    }

    if (hasDecisionTerm) {
        return { semanticType: "decision", confidence: 0.76 };
    }

    if (hasReminderTerm) {
        return { semanticType: "reminder", confidence: 0.72 };
    }

    return { semanticType: "chat", confidence: 0.94 };
}
type LlmDecision = {
    semanticType: "task" | "chat" | "decision" | "reminder" | "unknown";
    confidence: number;
    actionType: TaskExecutionActionType;
    parameters?: Record<string, unknown>;
    needsApproval: boolean;
};

function clampConfidence(value: number | undefined, fallback: number) {
    if (typeof value !== "number" || Number.isNaN(value)) return fallback;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function decideExecutionActionFromHeuristics(content: string): TaskExecutionDecision {
    const normalized = normalizeContent(content).toLowerCase();

    const isBugOrFix = ["bug", "issue", "error", "broken", "fix", "regression"].some((term) =>
        normalized.includes(term)
    );

    if (isBugOrFix) {
        return {
            actionType: "create_github_issue",
            parameters: {
                title: toTaskTitle(content),
                body: content,
            },
            confidence: 0.74,
            needsApproval: false,
        };
    }

    const isScheduling = ["schedule", "meeting", "calendar", "call", "sync", "book"].some((term) =>
        normalized.includes(term)
    );

    if (isScheduling) {
        return {
            actionType: "schedule_meeting",
            parameters: {
                summary: toTaskTitle(content),
                notes: content,
            },
            confidence: 0.7,
            needsApproval: true,
        };
    }

    const isEmail = ["email", "mail", "send this", "send an update", "notify"].some((term) =>
        normalized.includes(term)
    );

    if (isEmail) {
        return {
            actionType: "send_email",
            parameters: {
                subject: toTaskTitle(content),
                body: content,
            },
            confidence: 0.68,
            needsApproval: true,
        };
    }

    return {
        actionType: "none",
        parameters: {},
        confidence: 0.5,
        needsApproval: false,
    };
}

async function classifyMessageWithLLM(content: string): Promise<IntelligenceDecision> {
    const apiKey = process.env.OPENAI_API_KEY;
    const fallbackClassification = classifyMessage(content);
    const fallbackExecution = decideExecutionActionFromHeuristics(content);

    if (!apiKey) {
        return {
            classification: fallbackClassification,
            execution: fallbackExecution,
        };
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4.1-mini",
            input: [
                {
                    role: "system",
                    content:
                        "Classify message intent and execution action. Return strict JSON only with this exact shape: {semanticType, confidence, actionType, parameters, needsApproval}. actionType must be one of create_github_issue, schedule_meeting, send_email, none.",
                },
                { role: "user", content },
            ],
            // keep output constrained for deterministic parsing
            text: {
                format: {
                    type: "json_schema",
                    name: "task_intent_and_action",
                    schema: {
                        type: "object",
                        properties: {
                            semanticType: {
                                type: "string",
                                enum: ["task", "chat", "decision", "reminder", "unknown"],
                            },
                            confidence: { type: "number", minimum: 0, maximum: 1 },
                            actionType: {
                                type: "string",
                                enum: ["create_github_issue", "schedule_meeting", "send_email", "none"],
                            },
                            parameters: {
                                type: "object",
                                additionalProperties: true,
                            },
                            needsApproval: { type: "boolean" },
                        },
                        required: ["semanticType", "confidence", "actionType", "parameters", "needsApproval"],
                        additionalProperties: false,
                    },
                },
            },
        }),
    });

    if (!response.ok) {
        return {
            classification: fallbackClassification,
            execution: fallbackExecution,
        };
    }

    try {
        const payload = await response.json();
        const jsonText =
            payload?.output_text ??
            payload?.output?.[0]?.content?.[0]?.text ??
            "{}";

        const parsed = JSON.parse(jsonText) as LlmDecision;

        return {
            classification: {
                semanticType: parsed.semanticType,
                confidence: clampConfidence(parsed.confidence, fallbackClassification.confidence),
            },
            execution: {
                actionType: parsed.actionType,
                parameters: parsed.parameters && typeof parsed.parameters === "object" ? parsed.parameters : {},
                confidence: clampConfidence(parsed.confidence, fallbackExecution.confidence),
                needsApproval: Boolean(parsed.needsApproval),
            },
        };
    } catch {
        return {
            classification: fallbackClassification,
            execution: fallbackExecution,
        };
    }
}

function toTaskTitle(content: string) {
    const normalized = normalizeContent(content);
    if (!normalized) return "Follow up";

    const withoutPrefix = normalized.replace(/^(@\w+[:,]?\s*)+/, "");
    const trimmed = withoutPrefix.slice(0, 200);
    if (trimmed.length >= 3) return trimmed;

    return normalized.slice(0, 200);
}

export async function processMessageTaskIntelligence(
    input: ProcessMessageTaskIntelligenceInput
): Promise<ProcessMessageTaskIntelligenceResult | null> {
    if (input.messageType !== "text") {
        return null;
    }

    await connectToDatabase();

    const existing = await MessageModel.findById(input.messageId).select(
        "_id conversationId manualOverride semanticProcessedAt aiStatus linkedTaskIds"
    );

    if (!existing || existing.manualOverride) {
        return null;
    }

    if (existing.semanticProcessedAt && existing.aiStatus === "classified") {
        return null;
    }

    const decision = await classifyMessageWithLLM(input.content);
    const classification = decision.classification;
    const processedAt = new Date();

    if (classification.semanticType !== "task") {
        await updateMessageSemanticState(input.messageId, {
            semanticType: classification.semanticType,
            semanticConfidence: classification.confidence,
            aiStatus: "classified",
            aiVersion: AI_VERSION,
            linkedTaskIds: [],
            semanticProcessedAt: processedAt,
        });

        return {
            semanticPayload: {
                messageId: input.messageId,
                conversationId: input.conversationId,
                semanticType: classification.semanticType,
                semanticConfidence: classification.confidence,
                aiStatus: "classified",
                aiVersion: AI_VERSION,
                linkedTaskIds: [],
                semanticProcessedAt: processedAt.toISOString(),
            },
        };
    }

    const title = toTaskTitle(input.content);
    const dedupeKey = deriveTaskDedupeKey({
        conversationId: input.conversationId,
        title,
        sourceMessageId: input.messageId,
    });

    const preExistingTask = await TaskModel.findOne({ dedupeKey }).select("_id version").lean();

    const task = await upsertTaskByDedupeKey({
        conversationId: input.conversationId,
        title,
        description: "",
        assignees: [],
        dueAt: null,
        priority: "medium",
        source: "ai",
        sourceMessageIds: [input.messageId],
        latestContextMessageId: input.messageId,
        confidence: classification.confidence,
        tags: [],
        dedupeKey,
        createdBy: input.senderId,
    });

    await linkMessageToTask({
        taskId: task._id.toString(),
        messageId: input.messageId,
        conversationId: input.conversationId,
        linkType: "source",
        idempotencyKey: `link::${input.messageId}::${task._id.toString()}`,
    });

    await updateMessageSemanticState(input.messageId, {
        semanticType: "task",
        semanticConfidence: classification.confidence,
        aiStatus: "classified",
        aiVersion: AI_VERSION,
        linkedTaskIds: [task._id.toString()],
        semanticProcessedAt: processedAt,
    });

    if (decision.execution.actionType !== "none") {
        await enqueueOutboxEvent({
            topic: "task.execution.requested",
            dedupeKey: `task.execution.requested:${task._id.toString()}:${input.messageId}:${decision.execution.actionType}`,
            payload: {
                taskId: task._id.toString(),
                conversationId: input.conversationId,
                triggerMessageId: input.messageId,
                requestedByType: "agent",
                requestedById: null,
                actionType: decision.execution.actionType,
                parameters: decision.execution.parameters,
                confidence: decision.execution.confidence,
                needsApproval: decision.execution.needsApproval,
            },
        });
    }

    try {
        await createTaskAction({
            taskId: task._id.toString(),
            conversationId: input.conversationId,
            actorType: "agent",
            actorId: null,
            actionType: preExistingTask ? "linked_message" : "created",
            messageId: input.messageId,
            patch: {
                before: preExistingTask ? { latestContextMessageId: null } : null,
                after: { latestContextMessageId: input.messageId },
            },
            reason: "Automatic task extraction from message",
            idempotencyKey: buildTaskActionIdempotencyKey(
                task._id.toString(),
                preExistingTask ? "linked_message" : "created",
                input.messageId
            ),
        });
    } catch (error) {
        // Duplicate key errors can happen on retries and are safe to ignore.
        const maybeMongoError = error as { code?: number };
        if (maybeMongoError?.code !== 11000) {
            throw error;
        }
    }

    const semanticPayload: MessageSemanticUpdatedPayload = {
        messageId: input.messageId,
        conversationId: input.conversationId,
        semanticType: "task",
        semanticConfidence: classification.confidence,
        aiStatus: "classified",
        aiVersion: AI_VERSION,
        linkedTaskIds: [task._id.toString()],
        semanticProcessedAt: processedAt.toISOString(),
    };

    const taskLinkedPayload: TaskLinkedToMessagePayload = {
        taskId: task._id.toString(),
        messageId: input.messageId,
        conversationId: input.conversationId,
        linkType: "source",
        taskVersion: task.version,
    };

    if (!preExistingTask) {
        return {
            semanticPayload,
            taskLinkedPayload,
            taskCreatedPayload: {
                task: {
                    _id: task._id.toString(),
                    conversationId: task.conversationId.toString(),
                    title: task.title,
                    description: task.description,
                    status: task.status,
                    priority: task.priority,
                    assignees: task.assignees.map((assignee) => assignee.toString()),
                    dueAt: task.dueAt ? new Date(task.dueAt).toISOString() : null,
                    createdBy: task.createdBy.toString(),
                    source: task.source,
                    sourceMessageIds: task.sourceMessageIds.map((sourceMessageId) => sourceMessageId.toString()),
                    latestContextMessageId: task.latestContextMessageId
                        ? task.latestContextMessageId.toString()
                        : null,
                    confidence: task.confidence,
                    tags: task.tags,
                    dedupeKey: task.dedupeKey,
                    version: task.version,
                    closedAt: task.closedAt ? new Date(task.closedAt).toISOString() : null,
                    archivedAt: task.archivedAt ? new Date(task.archivedAt).toISOString() : null,
                    updatedBy: task.updatedBy ? task.updatedBy.toString() : null,
                    createdAt: new Date(task.createdAt).toISOString(),
                    updatedAt: new Date(task.updatedAt).toISOString(),
                },
                sourceMessageId: input.messageId,
                createdByType: "agent",
            },
        };
    }

    return {
        semanticPayload,
        taskLinkedPayload,
        taskUpdatedPayload: {
            taskId: task._id.toString(),
            conversationId: input.conversationId,
            patch: {
                latestContextMessageId: input.messageId,
                updatedBy: null,
            },
            previousVersion: preExistingTask.version,
            newVersion: task.version,
            updatedByType: "agent",
            updatedById: null,
        },
    };
}