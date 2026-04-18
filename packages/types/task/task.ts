export type TaskStatus = "pending" | "executing" | "completed" | "failed" | "partial";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskSource = "ai" | "manual" | "imported";

export type MessageSemanticType = "chat" | "task" | "decision" | "reminder" | "unknown";

export type MessageAiStatus = "pending" | "classified" | "failed" | "overridden";

export type TaskActionType =
    | "created"
    | "reassigned"
    | "status_changed"
    | "priority_changed"
    | "due_changed"
    | "linked_message"
    | "unlinked_message"
    | "commented"
    | "ai_reclassified";

export type TaskActorType = "user" | "agent" | "system";

export type TaskLinkType = "source" | "context" | "decision";

export type TaskExecutionActionType = "create_github_issue" | "schedule_meeting" | "send_email" | "none";

export interface TaskResult {
    success: boolean;
    confidence: number;
    evidence: unknown;
    error?: string;
}

export interface MessageTaskMetadata {
    semanticType?: MessageSemanticType;
    semanticConfidence?: number;
    aiStatus?: MessageAiStatus;
    aiVersion?: string | null;
    linkedTaskIds?: string[];
    manualOverride?: boolean;
    overrideBy?: string | null;
    overrideAt?: string | null;
    semanticProcessedAt?: string | null;
}

export interface TaskRecord {
    _id: string;
    conversationId: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignees: string[];
    dueAt: string | null;
    createdBy: string;
    source: TaskSource;
    sourceMessageIds: string[];
    latestContextMessageId: string | null;
    confidence: number;
    tags: string[];
    dedupeKey: string;
    result: TaskResult;
    version: number;
    closedAt: string | null;
    archivedAt: string | null;
    updatedBy: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface TaskActionRecord {
    _id: string;
    taskId: string;
    conversationId: string;
    actorType: TaskActorType;
    actorId: string | null;
    actionType: TaskActionType;
    messageId: string | null;
    patch: {
        before: unknown | null;
        after: unknown | null;
    };
    reason: string;
    idempotencyKey: string;
    createdAt: string;
}

export interface MessageIntentRecord {
    _id: string;
    messageId: string;
    conversationId: string;
    intentType: "request" | "commit" | "reminder" | "decision" | "question" | "info";
    entities: {
        actionVerb: string;
        objectText: string;
        assigneeUserIds: string[];
        dueAtCandidate: string | null;
        priorityCandidate: TaskPriority | "";
    };
    confidence: number;
    extractorVersion: string;
    rawSummary: string;
    createdAt: string;
}