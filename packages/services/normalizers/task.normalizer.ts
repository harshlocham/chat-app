import type { TaskRecord } from "@chat/types";
import type { ITask } from "@/models/Task";

export function normalizeTask(doc: ITask): TaskRecord {
    return {
        _id: doc._id.toString(),
        conversationId: doc.conversationId.toString(),
        title: doc.title,
        description: doc.description,
        status: doc.status,
        priority: doc.priority,
        assignees: doc.assignees.map((assignee) => assignee.toString()),
        dueAt: doc.dueAt ? new Date(doc.dueAt).toISOString() : null,
        createdBy: doc.createdBy.toString(),
        source: doc.source,
        sourceMessageIds: doc.sourceMessageIds.map((messageId) => messageId.toString()),
        latestContextMessageId: doc.latestContextMessageId
            ? doc.latestContextMessageId.toString()
            : null,
        confidence: doc.confidence,
        tags: doc.tags,
        dedupeKey: doc.dedupeKey,
        result: {
            success: Boolean(doc.result?.success),
            confidence: typeof doc.result?.confidence === "number" ? doc.result.confidence : 0,
            evidence: doc.result?.evidence ?? null,
            ...(typeof doc.result?.error === "string" && doc.result.error.length > 0
                ? { error: doc.result.error }
                : {}),
        },
        version: doc.version,
        closedAt: doc.closedAt ? new Date(doc.closedAt).toISOString() : null,
        archivedAt: doc.archivedAt ? new Date(doc.archivedAt).toISOString() : null,
        updatedBy: doc.updatedBy ? doc.updatedBy.toString() : null,
        createdAt: new Date(doc.createdAt).toISOString(),
        updatedAt: new Date(doc.updatedAt).toISOString(),
    };
}