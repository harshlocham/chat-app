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
        version: doc.version,
        closedAt: doc.closedAt ? new Date(doc.closedAt).toISOString() : null,
        archivedAt: doc.archivedAt ? new Date(doc.archivedAt).toISOString() : null,
        updatedBy: doc.updatedBy ? doc.updatedBy.toString() : null,
        createdAt: new Date(doc.createdAt).toISOString(),
        updatedAt: new Date(doc.updatedAt).toISOString(),
    };
}