import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/Db/db";
import TaskModel, { ITask } from "@/models/Task";
import TaskActionModel, { ITaskAction } from "@/models/TaskAction";
import MessageModel, { IMessage } from "@/models/Message";
import type { CreateTaskActionInput, CreateTaskInput, LinkMessageToTaskInput, UpdateTaskInput } from "@/lib/validators/task.schema";

const toObjectId = (value: string) => new Types.ObjectId(value);

export function buildTaskDedupeKey(conversationId: string, normalizedTitle: string, sourceMessageId?: string | null) {
    const titlePart = normalizedTitle.trim().toLowerCase().replace(/\s+/g, " ");
    return [conversationId, titlePart, sourceMessageId ?? ""].join("::");
}

export function buildTaskActionIdempotencyKey(taskId: string, actionType: string, sourceId?: string | null) {
    return [taskId, actionType, sourceId ?? ""].join("::");
}

export function deriveTaskDedupeKey(input: { conversationId: string; title: string; sourceMessageId?: string | null }) {
    const normalizedTitle = input.title.trim().toLowerCase().replace(/\s+/g, " ");
    return buildTaskDedupeKey(input.conversationId, normalizedTitle, input.sourceMessageId ?? null);
}

export async function createTask(input: CreateTaskInput): Promise<ITask> {
    await connectToDatabase();

    const task = new TaskModel({
        conversationId: toObjectId(input.conversationId),
        title: input.title,
        description: input.description ?? "",
        status: "open",
        priority: input.priority ?? "medium",
        assignees: input.assignees.map(toObjectId),
        dueAt: input.dueAt ?? null,
        createdBy: toObjectId(input.createdBy),
        source: input.source,
        sourceMessageIds: input.sourceMessageIds.map(toObjectId),
        latestContextMessageId: input.latestContextMessageId ? toObjectId(input.latestContextMessageId) : null,
        confidence: input.confidence ?? 1,
        tags: input.tags ?? [],
        dedupeKey: input.dedupeKey,
    });

    await task.save();
    return task;
}

export async function upsertTaskByDedupeKey(input: CreateTaskInput): Promise<ITask> {
    await connectToDatabase();

    const task = await TaskModel.findOneAndUpdate(
        { dedupeKey: input.dedupeKey },
        {
            $setOnInsert: {
                conversationId: toObjectId(input.conversationId),
                title: input.title,
                description: input.description ?? "",
                status: "open",
                priority: input.priority ?? "medium",
                assignees: input.assignees.map(toObjectId),
                dueAt: input.dueAt ?? null,
                createdBy: toObjectId(input.createdBy),
                source: input.source,
                sourceMessageIds: input.sourceMessageIds.map(toObjectId),
                latestContextMessageId: input.latestContextMessageId ? toObjectId(input.latestContextMessageId) : null,
                confidence: input.confidence ?? 1,
                tags: input.tags ?? [],
                dedupeKey: input.dedupeKey,
            },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (!task) {
        throw new Error("Failed to create or load task");
    }

    return task;
}

export async function updateTask(update: UpdateTaskInput): Promise<ITask | null> {
    await connectToDatabase();

    const next = await TaskModel.findByIdAndUpdate(
        update.taskId,
        {
            ...(update.title !== undefined ? { title: update.title } : {}),
            ...(update.description !== undefined ? { description: update.description } : {}),
            ...(update.status !== undefined ? { status: update.status } : {}),
            ...(update.priority !== undefined ? { priority: update.priority } : {}),
            ...(update.assignees !== undefined ? { assignees: update.assignees.map(toObjectId) } : {}),
            ...(update.dueAt !== undefined ? { dueAt: update.dueAt } : {}),
            ...(update.tags !== undefined ? { tags: update.tags } : {}),
            ...(update.latestContextMessageId !== undefined
                ? { latestContextMessageId: update.latestContextMessageId ? toObjectId(update.latestContextMessageId) : null }
                : {}),
            ...(update.updatedBy !== undefined
                ? { updatedBy: update.updatedBy ? toObjectId(update.updatedBy) : null }
                : {}),
        },
        { new: true }
    );

    return next;
}

export async function createTaskAction(input: CreateTaskActionInput): Promise<ITaskAction> {
    await connectToDatabase();

    const action = new TaskActionModel({
        taskId: toObjectId(input.taskId),
        conversationId: toObjectId(input.conversationId),
        actorType: input.actorType,
        actorId: input.actorId ? toObjectId(input.actorId) : null,
        actionType: input.actionType,
        messageId: input.messageId ? toObjectId(input.messageId) : null,
        parameters: input.parameters ?? {},
        executionState: input.executionState ?? null,
        summary: input.summary ?? null,
        error: input.error ?? null,
        patch: input.patch,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
    });

    await action.save();
    return action;
}

export async function linkMessageToTask(input: LinkMessageToTaskInput) {
    await connectToDatabase();

    const [message, task] = await Promise.all([
        MessageModel.findById(input.messageId),
        TaskModel.findById(input.taskId),
    ]);

    if (!message) {
        throw new Error("Message not found");
    }

    if (!task) {
        throw new Error("Task not found");
    }

    await MessageModel.updateOne(
        { _id: message._id },
        {
            $addToSet: { linkedTaskIds: task._id },
            $set: {
                semanticType: "task",
                aiStatus: "classified",
                semanticProcessedAt: new Date(),
            },
        }
    );

    await TaskModel.updateOne(
        { _id: task._id },
        {
            $addToSet: { sourceMessageIds: message._id },
            $set: { latestContextMessageId: message._id },
        }
    );

    return {
        taskId: task._id.toString(),
        messageId: message._id.toString(),
        conversationId: input.conversationId,
        linkType: input.linkType,
    };
}

export async function updateMessageSemanticState(messageId: string, patch: Partial<Pick<IMessage, "semanticType" | "semanticConfidence" | "aiStatus" | "aiVersion" | "manualOverride" | "semanticProcessedAt">> & {
    linkedTaskIds?: string[];
    overrideBy?: string | null;
    overrideAt?: Date | null;
}) {
    await connectToDatabase();

    const update: Record<string, unknown> = {};

    if (patch.semanticType !== undefined) update.semanticType = patch.semanticType;
    if (patch.semanticConfidence !== undefined) update.semanticConfidence = patch.semanticConfidence;
    if (patch.aiStatus !== undefined) update.aiStatus = patch.aiStatus;
    if (patch.aiVersion !== undefined) update.aiVersion = patch.aiVersion;
    if (patch.manualOverride !== undefined) update.manualOverride = patch.manualOverride;
    if (patch.semanticProcessedAt !== undefined) update.semanticProcessedAt = patch.semanticProcessedAt;
    if (patch.overrideBy !== undefined) update.overrideBy = patch.overrideBy ? new Types.ObjectId(patch.overrideBy) : null;
    if (patch.overrideAt !== undefined) update.overrideAt = patch.overrideAt;
    if (patch.linkedTaskIds !== undefined) {
        update.linkedTaskIds = patch.linkedTaskIds.map((id) => new Types.ObjectId(id));
    }

    return MessageModel.updateOne({ _id: messageId }, { $set: update });
}