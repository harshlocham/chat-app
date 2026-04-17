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

const AI_VERSION = "intelligent-v2";
const STRICT_EMAIL_TEMPLATE_MODE = process.env.STRICT_EMAIL_TEMPLATE_MODE !== "false";
const STRICT_ACTION_TEMPLATE_MODE = process.env.STRICT_ACTION_TEMPLATE_MODE !== "false";

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

interface TaskDraft {
    title: string;
    description: string;
}

interface IntelligenceDecision {
    classification: ClassificationResult;
    execution: TaskExecutionDecision;
    taskDraft: TaskDraft;
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

    const explicitAction = inferExplicitAction(content);
    if (explicitAction && explicitAction !== "none") {
        return { semanticType: "task", confidence: 0.9 };
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
    taskTitle?: string;
    taskDescription?: string;
};

function clampConfidence(value: number | undefined, fallback: number) {
    if (typeof value !== "number" || Number.isNaN(value)) return fallback;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function buildTaskDescription(content: string) {
    const normalized = normalizeContent(content);
    if (!normalized) {
        return "No additional context was provided.";
    }

    const stripped = normalized
        .replace(/^send an email to\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\s+saying\s+/i, "")
        .replace(/^please\s+/i, "")
        .trim();

    return stripped.length > 0
        ? `Requested outcome: ${stripped.charAt(0).toUpperCase()}${stripped.slice(1)}`
        : `Requested outcome: ${normalized}`;
}

function normalizeTaskDraft(content: string, draft: Partial<TaskDraft> | null | undefined): TaskDraft {
    const fallbackTitle = toTaskTitle(content);
    const fallbackDescription = buildTaskDescription(content);

    const normalizedTitle = typeof draft?.title === "string" ? normalizeContent(draft.title) : "";
    const normalizedDescription = typeof draft?.description === "string" ? normalizeContent(draft.description) : "";

    return {
        title: normalizedTitle.length >= 3 ? normalizedTitle.slice(0, 200) : fallbackTitle,
        description: normalizedDescription.length > 0 ? normalizedDescription.slice(0, 8000) : fallbackDescription,
    };
}

function buildEmailCopy(content: string, baseTitle: string) {
    const normalized = normalizeContent(content);
    const sayingMatch = normalized.match(/\bsaying\s+(.+)/i);
    const requestedMessage = sayingMatch?.[1]?.trim() ?? normalized;
    const sentence = requestedMessage.charAt(0).toUpperCase() + requestedMessage.slice(1);

    return {
        subject: `Update: ${baseTitle}`.slice(0, 160),
        body: `${sentence}${sentence.endsWith(".") ? "" : "."}\n\nRegards,\nTask Assistant`,
    };
}

function buildStrictEmailTemplate(content: string, baseTitle: string, recipients: string[]) {
    const normalized = normalizeContent(content);
    const updateFromReport = normalized.match(/\bto report\s+(.+)/i)?.[1]?.trim();
    const updateFromSaying = normalized.match(/\bsaying\s+(.+)/i)?.[1]?.trim();
    const requestedUpdate = updateFromReport || updateFromSaying || "The requested task update is complete";
    const cleanUpdate = requestedUpdate.charAt(0).toUpperCase() + requestedUpdate.slice(1).replace(/[.\s]+$/g, "");

    const recipientLabel = recipients.length > 0 ? recipients[0] : "there";

    return {
        subject: `Status Update: ${baseTitle}`.slice(0, 160),
        body: [
            `Hello ${recipientLabel},`,
            "",
            `Quick update: ${cleanUpdate}.`,
            "",
            "Please let me know if you need any additional details.",
            "",
            "Best regards,",
            "Taskflow Assistant",
        ].join("\n"),
    };
}

function buildStrictMeetingTemplate(content: string, baseTitle: string, hints: { whenText: string | null; attendeesText: string | null }) {
    const normalized = normalizeContent(content);
    const meetingGoal = normalized
        .replace(/^schedule (a )?(meeting|call|sync)\s*/i, "")
        .replace(/^with\s+/i, "")
        .trim();

    const objective = meetingGoal.length > 0 ? meetingGoal : "Discuss the requested update and next steps";
    const whenLine = hints.whenText ? `Proposed time: ${hints.whenText}.` : "Proposed time: To be confirmed.";
    const attendeesLine = hints.attendeesText ? `Attendees: ${hints.attendeesText}.` : "Attendees: To be confirmed.";

    return {
        summary: `Meeting Request: ${baseTitle}`.slice(0, 200),
        notes: [
            "Objective:",
            `${objective.charAt(0).toUpperCase()}${objective.slice(1)}.`,
            "",
            whenLine,
            attendeesLine,
            "",
            "Agenda:",
            "1) Review current status",
            "2) Discuss blockers",
            "3) Confirm next actions",
        ].join("\n"),
        whenText: hints.whenText,
        attendeesText: hints.attendeesText,
    };
}

function buildStrictGithubIssueTemplate(content: string, baseTitle: string) {
    const normalized = normalizeContent(content);
    const stripped = normalized
        .replace(/^create (a )?github issue\s*/i, "")
        .replace(/^report\s*/i, "")
        .trim();

    const problemStatement = stripped.length > 0 ? stripped : normalized;
    const cleanProblem = `${problemStatement.charAt(0).toUpperCase()}${problemStatement.slice(1).replace(/[.\s]+$/g, "")}.`;

    return {
        title: `Bug Report: ${baseTitle}`.slice(0, 200),
        body: [
            "## Summary",
            cleanProblem,
            "",
            "## Impact",
            "The issue affects normal workflow and should be investigated promptly.",
            "",
            "## Expected Result",
            "The affected flow should complete successfully without errors.",
            "",
            "## Suggested Next Steps",
            "1. Reproduce the issue locally",
            "2. Identify root cause",
            "3. Implement and verify a fix",
        ].join("\n"),
    };
}

function extractEmailRecipients(content: string) {
    const matches = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    return [...new Set(matches.map((email) => email.toLowerCase()))];
}

function extractMeetingHints(content: string) {
    const normalized = normalizeContent(content);
    const whenMatch = normalized.match(/\b(?:today|tomorrow|tonight|next week|next month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?::\d{2})?\s?(?:am|pm)?(?:\s?[A-Z]{2,4})?)\b/i);
    const withMatch = normalized.match(/\bwith\s+([^.,;]+)/i);

    return {
        whenText: whenMatch?.[0] ?? null,
        attendeesText: withMatch?.[1]?.trim() ?? null,
    };
}

function inferExplicitAction(content: string): TaskExecutionActionType | null {
    const normalized = normalizeContent(content).toLowerCase();
    const emailRecipients = extractEmailRecipients(content);

    if (emailRecipients.length > 0 || ["send an email", "send email", "email ", "mail to", "notify by email"].some((term) => normalized.includes(term))) {
        return "send_email";
    }

    if (["schedule a meeting", "schedule meeting", "book a meeting", "set up a meeting", "set up a call", "calendar invite", "sync up"].some((term) => normalized.includes(term))) {
        return "schedule_meeting";
    }

    if (["bug", "issue", "error", "broken", "fix", "regression"].some((term) => normalized.includes(term))) {
        return "create_github_issue";
    }

    return null;
}

function normalizeExecutionParameters(content: string, decision: TaskExecutionDecision): TaskExecutionDecision {
    const explicitAction = inferExplicitAction(content);
    const actionType = explicitAction ?? decision.actionType;
    const emailRecipients = extractEmailRecipients(content);
    const meetingHints = extractMeetingHints(content);
    const baseTitle = toTaskTitle(content);

    if (actionType === "send_email") {
        const polished = buildEmailCopy(content, baseTitle);
        const toValue = decision.parameters.to;
        const to = Array.isArray(toValue)
            ? toValue.filter((value): value is string => typeof value === "string" && value.length > 0)
            : typeof toValue === "string"
                ? [toValue]
                : emailRecipients;
        const strictTemplate = buildStrictEmailTemplate(content, baseTitle, to);

        const rawSubject = typeof decision.parameters.subject === "string" ? normalizeContent(decision.parameters.subject).toLowerCase() : "";
        const rawBody = typeof decision.parameters.body === "string" ? normalizeContent(decision.parameters.body).toLowerCase() : "";
        const normalizedContent = normalizeContent(content).toLowerCase();

        const shouldRewriteSubject =
            rawSubject.length === 0
            || rawSubject === normalizeContent(baseTitle).toLowerCase()
            || rawSubject.startsWith("send an email")
            || rawSubject.includes(" saying ");

        const shouldRewriteBody =
            rawBody.length === 0
            || rawBody === normalizedContent
            || rawBody.startsWith("send an email")
            || rawBody.includes(" saying ");

        return {
            ...decision,
            actionType,
            parameters: {
                ...decision.parameters,
                to,
                subject: STRICT_EMAIL_TEMPLATE_MODE
                    ? strictTemplate.subject
                    : (shouldRewriteSubject ? polished.subject : decision.parameters.subject),
                body: STRICT_EMAIL_TEMPLATE_MODE
                    ? strictTemplate.body
                    : (shouldRewriteBody ? polished.body : decision.parameters.body),
            },
            confidence: Math.max(decision.confidence, to.length > 0 ? 0.9 : 0.8),
            needsApproval: decision.needsApproval || to.length === 0,
        };
    }

    if (actionType === "schedule_meeting") {
        const strictMeeting = buildStrictMeetingTemplate(content, baseTitle, meetingHints);
        return {
            ...decision,
            actionType,
            parameters: {
                ...decision.parameters,
                summary: STRICT_ACTION_TEMPLATE_MODE
                    ? strictMeeting.summary
                    : (typeof decision.parameters.summary === "string" ? decision.parameters.summary : baseTitle),
                notes: STRICT_ACTION_TEMPLATE_MODE
                    ? strictMeeting.notes
                    : (typeof decision.parameters.notes === "string" ? decision.parameters.notes : content),
                whenText: STRICT_ACTION_TEMPLATE_MODE
                    ? strictMeeting.whenText
                    : (typeof decision.parameters.whenText === "string" ? decision.parameters.whenText : meetingHints.whenText),
                attendeesText: STRICT_ACTION_TEMPLATE_MODE
                    ? strictMeeting.attendeesText
                    : (typeof decision.parameters.attendeesText === "string" ? decision.parameters.attendeesText : meetingHints.attendeesText),
            },
            confidence: Math.max(decision.confidence, 0.78),
            needsApproval: true,
        };
    }

    if (actionType === "create_github_issue") {
        const strictIssue = buildStrictGithubIssueTemplate(content, baseTitle);
        return {
            ...decision,
            actionType,
            parameters: {
                ...decision.parameters,
                title: STRICT_ACTION_TEMPLATE_MODE
                    ? strictIssue.title
                    : (typeof decision.parameters.title === "string" ? decision.parameters.title : baseTitle),
                body: STRICT_ACTION_TEMPLATE_MODE
                    ? strictIssue.body
                    : (typeof decision.parameters.body === "string" ? decision.parameters.body : content),
            },
            confidence: Math.max(decision.confidence, 0.7),
            needsApproval: Boolean(decision.needsApproval && decision.confidence < 0.8),
        };
    }

    return {
        ...decision,
        actionType,
    };
}

function buildActionSummary(actionType: TaskExecutionActionType, parameters: Record<string, unknown>) {
    switch (actionType) {
        case "send_email":
            return `Requested email to ${Array.isArray(parameters.to) ? parameters.to.join(", ") : "unknown recipient"}.`;
        case "schedule_meeting":
            return "Requested meeting scheduling action.";
        case "create_github_issue":
            return "Requested GitHub issue creation action.";
        case "none":
        default:
            return "No executable action selected.";
    }
}

function decideExecutionActionFromHeuristics(content: string): TaskExecutionDecision {
    const normalized = normalizeContent(content).toLowerCase();

    if (inferExplicitAction(content) === "send_email") {
        return {
            actionType: "send_email",
            parameters: {
                to: extractEmailRecipients(content),
                subject: toTaskTitle(content),
                body: content,
            },
            confidence: 0.86,
            needsApproval: false,
        };
    }

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
                ...extractMeetingHints(content),
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
                to: extractEmailRecipients(content),
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
        const normalizedFallbackExecution = normalizeExecutionParameters(content, fallbackExecution);
        const fallbackSemanticType = normalizedFallbackExecution.actionType !== "none"
            ? "task"
            : fallbackClassification.semanticType;
        return {
            classification: {
                semanticType: fallbackSemanticType,
                confidence: fallbackSemanticType === "task"
                    ? Math.max(fallbackClassification.confidence, 0.85)
                    : fallbackClassification.confidence,
            },
            execution: normalizedFallbackExecution,
            taskDraft: normalizeTaskDraft(content, null),
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
                        [
                            "You are a task intelligence router.",
                            "Classify the message semantic intent and the most likely executable action.",
                            "If the message explicitly requests email delivery, choose send_email even if it also mentions fixing a bug.",
                            "If the message explicitly requests scheduling, choose schedule_meeting.",
                            "Extract useful parameters:",
                            "- send_email: to, subject, body",
                            "- schedule_meeting: summary, notes, whenText, attendeesText",
                            "- create_github_issue: title, body, labels",
                            "Also produce taskTitle and taskDescription suitable for a task board.",
                            "taskTitle must be concise and actionable (max 120 chars).",
                            "taskDescription must be clear and professional with concrete outcome.",
                            "Return strict JSON only with: semanticType, confidence, actionType, parameters, needsApproval, taskTitle, taskDescription.",
                            "actionType must be one of create_github_issue, schedule_meeting, send_email, none.",
                        ].join(" "),
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
                            taskTitle: { type: "string", minLength: 3, maxLength: 200 },
                            taskDescription: { type: "string", minLength: 3, maxLength: 8000 },
                        },
                        required: ["semanticType", "confidence", "actionType", "parameters", "needsApproval", "taskTitle", "taskDescription"],
                        additionalProperties: false,
                    },
                },
            },
        }),
    });

    if (!response.ok) {
        return {
            classification: fallbackClassification,
            execution: normalizeExecutionParameters(content, fallbackExecution),
            taskDraft: normalizeTaskDraft(content, null),
        };
    }

    try {
        const payload = await response.json();
        const jsonText =
            payload?.output_text ??
            payload?.output?.[0]?.content?.[0]?.text ??
            "{}";

        const parsed = JSON.parse(jsonText) as LlmDecision;
        const normalizedExecution = normalizeExecutionParameters(content, {
            actionType: parsed.actionType,
            parameters: parsed.parameters && typeof parsed.parameters === "object" ? parsed.parameters : {},
            confidence: clampConfidence(parsed.confidence, fallbackExecution.confidence),
            needsApproval: Boolean(parsed.needsApproval),
        });
        const taskDraft = normalizeTaskDraft(content, {
            title: parsed.taskTitle,
            description: parsed.taskDescription,
        });
        const semanticType = normalizedExecution.actionType !== "none"
            ? "task"
            : parsed.semanticType;
        const semanticConfidence = semanticType === "task"
            ? Math.max(clampConfidence(parsed.confidence, fallbackClassification.confidence), 0.85)
            : clampConfidence(parsed.confidence, fallbackClassification.confidence);

        return {
            classification: {
                semanticType,
                confidence: semanticConfidence,
            },
            execution: normalizedExecution,
            taskDraft,
        };
    } catch {
        const normalizedFallbackExecution = normalizeExecutionParameters(content, fallbackExecution);
        const fallbackSemanticType = normalizedFallbackExecution.actionType !== "none"
            ? "task"
            : fallbackClassification.semanticType;
        return {
            classification: {
                semanticType: fallbackSemanticType,
                confidence: fallbackSemanticType === "task"
                    ? Math.max(fallbackClassification.confidence, 0.85)
                    : fallbackClassification.confidence,
            },
            execution: normalizedFallbackExecution,
            taskDraft: normalizeTaskDraft(content, null),
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

    const draft = normalizeTaskDraft(input.content, decision.taskDraft);
    const title = draft.title;
    const dedupeKey = deriveTaskDedupeKey({
        conversationId: input.conversationId,
        title,
        sourceMessageId: input.messageId,
    });

    const preExistingTask = await TaskModel.findOne({ dedupeKey }).select("_id version").lean();

    const task = await upsertTaskByDedupeKey({
        conversationId: input.conversationId,
        title,
        description: draft.description,
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

        try {
            await createTaskAction({
                taskId: task._id.toString(),
                conversationId: input.conversationId,
                actorType: "agent",
                actorId: null,
                actionType: decision.execution.actionType,
                messageId: input.messageId,
                parameters: decision.execution.parameters,
                executionState: "requested",
                summary: buildActionSummary(decision.execution.actionType, decision.execution.parameters),
                error: null,
                patch: {
                    before: null,
                    after: {
                        actionType: decision.execution.actionType,
                        parameters: decision.execution.parameters,
                        confidence: decision.execution.confidence,
                        needsApproval: decision.execution.needsApproval,
                    },
                },
                reason: "Automatic action request from message",
                idempotencyKey: buildTaskActionIdempotencyKey(
                    task._id.toString(),
                    `requested:${decision.execution.actionType}`,
                    input.messageId
                ),
            });
        } catch (error) {
            const maybeMongoError = error as { code?: number };
            if (maybeMongoError?.code !== 11000) {
                throw error;
            }
        }
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