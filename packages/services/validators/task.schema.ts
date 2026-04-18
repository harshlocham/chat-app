import { z } from "zod";

const taskStatusSchema = z.enum(["pending", "executing", "completed", "failed", "partial"]);
const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const CreateTaskSchema = z.object({
    conversationId: z.string().min(1),
    parentTaskId: z.string().min(1).nullable().optional().default(null),
    title: z.string().min(3).max(200),
    description: z.string().max(8000).optional().default(""),
    assignees: z.array(z.string().min(1)).max(32).optional().default([]),
    dueAt: z.coerce.date().nullable().optional().default(null),
    priority: taskPrioritySchema.optional().default("medium"),
    source: z.enum(["ai", "manual", "imported"]).default("manual"),
    sourceMessageIds: z.array(z.string().min(1)).optional().default([]),
    latestContextMessageId: z.string().min(1).nullable().optional().default(null),
    confidence: z.number().min(0).max(1).optional().default(1),
    tags: z.array(z.string().min(1).max(48)).optional().default([]),
    dedupeKey: z.string().min(1).max(160),
    subTasks: z.array(z.string().min(1)).optional().default([]),
    dependencyIds: z.array(z.string().min(1)).optional().default([]),
    progress: z.number().min(0).max(100).optional().default(0),
    checkpoints: z.array(z.object({
        step: z.string().min(1).max(120),
        status: z.string().min(1).max(40),
        timestamp: z.coerce.date(),
    })).optional().default([]),
    executionHistory: z.object({
        attempts: z.number().int().min(0).default(0),
        failures: z.number().int().min(0).default(0),
        results: z.array(z.object({
            attempt: z.number().int().min(1),
            success: z.boolean(),
            summary: z.string().min(1).max(1200),
            error: z.string().max(4000).optional(),
            timestamp: z.coerce.date(),
        })).default([]),
    }).optional().default({ attempts: 0, failures: 0, results: [] }),
    createdBy: z.string().min(1),
});

export const UpdateTaskSchema = z.object({
    taskId: z.string().min(1),
    title: z.string().min(3).max(200).optional(),
    description: z.string().max(8000).optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assignees: z.array(z.string().min(1)).max(32).optional(),
    dueAt: z.coerce.date().nullable().optional(),
    tags: z.array(z.string().min(1).max(48)).optional(),
    latestContextMessageId: z.string().min(1).nullable().optional(),
    parentTaskId: z.string().min(1).nullable().optional(),
    subTasks: z.array(z.string().min(1)).optional(),
    dependencyIds: z.array(z.string().min(1)).optional(),
    result: z.object({
        success: z.boolean(),
        confidence: z.number().min(0).max(1),
        evidence: z.unknown(),
        error: z.string().max(4000).optional(),
    }).optional(),
    retryCount: z.number().int().min(0).optional(),
    maxRetries: z.number().int().min(0).optional(),
    progress: z.number().min(0).max(100).optional(),
    checkpoints: z.array(z.object({
        step: z.string().min(1).max(120),
        status: z.string().min(1).max(40),
        timestamp: z.coerce.date(),
    })).optional(),
    executionHistory: z.object({
        attempts: z.number().int().min(0),
        failures: z.number().int().min(0),
        results: z.array(z.object({
            attempt: z.number().int().min(1),
            success: z.boolean(),
            summary: z.string().min(1).max(1200),
            error: z.string().max(4000).optional(),
            timestamp: z.coerce.date(),
        })),
    }).optional(),
    updatedBy: z.string().min(1).nullable().optional(),
});

export const CreateTaskActionSchema = z.object({
    taskId: z.string().min(1),
    conversationId: z.string().min(1),
    actorType: z.enum(["user", "agent", "system"]),
    actorId: z.string().min(1).nullable().optional().default(null),
    actionType: z.enum([
        "created",
        "reassigned",
        "status_changed",
        "priority_changed",
        "due_changed",
        "linked_message",
        "unlinked_message",
        "commented",
        "ai_reclassified",
        "create_github_issue",
        "schedule_meeting",
        "send_email",
        "none",
    ]),
    messageId: z.string().min(1).nullable().optional().default(null),
    parameters: z.record(z.string(), z.unknown()).optional(),
    executionState: z.enum(["requested", "queued", "running", "succeeded", "failed", "blocked"]).nullable().optional(),
    summary: z.string().max(2000).nullable().optional(),
    error: z.string().max(4000).nullable().optional(),
    patch: z.object({
        before: z.unknown().nullable().optional().default(null),
        after: z.unknown().nullable().optional().default(null),
    }).optional().default({ before: null, after: null }),
    reason: z.string().max(2000).optional().default(""),
    idempotencyKey: z.string().min(1).max(160),
});

export const LinkMessageToTaskSchema = z.object({
    taskId: z.string().min(1),
    messageId: z.string().min(1),
    conversationId: z.string().min(1),
    linkType: z.enum(["source", "context", "decision"]),
    idempotencyKey: z.string().min(1).max(160),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type CreateTaskActionInput = z.infer<typeof CreateTaskActionSchema>;
export type LinkMessageToTaskInput = z.infer<typeof LinkMessageToTaskSchema>;