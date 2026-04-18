import { Types } from "mongoose";
import TaskModel, { ITask } from "@/models/Task";
import { createTask, createTaskAction, getLatestExecutionTaskAction, updateTask, buildTaskActionIdempotencyKey } from "@/lib/repositories/task.repo";
import type { TaskExecutionActionType } from "@chat/types";

export type PlannedSubTask = {
    title: string;
    description: string;
    actionType: TaskExecutionActionType;
    parameters: Record<string, unknown>;
};

export type TaskPlanResult = {
    parentTaskId: string;
    subTaskIds: string[];
    planned: boolean;
};

function normalizeText(value: string) {
    return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function splitSequentialSegments(content: string) {
    return content
        .split(/\s+(?:and then|then|and|after that|afterwards|plus)\s+/i)
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
}

function detectAction(segment: string): TaskExecutionActionType {
    const normalized = normalizeText(segment);

    if (/(schedule|meeting|calendar|book)/.test(normalized)) {
        return "schedule_meeting";
    }

    if (/(email|invite|send message|send invite)/.test(normalized)) {
        return "send_email";
    }

    if (/(github|issue|ticket|bug)/.test(normalized)) {
        return "create_github_issue";
    }

    return "none";
}

function buildSubTaskTitle(actionType: TaskExecutionActionType, segment: string) {
    switch (actionType) {
        case "schedule_meeting":
            return /invite/i.test(segment) ? "Schedule meeting" : "Create meeting";
        case "send_email":
            return /invite/i.test(segment) ? "Send invite email" : "Send email";
        case "create_github_issue":
            return "Create GitHub issue";
        default:
            return segment;
    }
}

function buildSubTaskParameters(actionType: TaskExecutionActionType, parentTask: ITask, segment: string) {
    const baseBody = parentTask.description || parentTask.title;

    switch (actionType) {
        case "schedule_meeting":
            return {
                summary: parentTask.title,
                notes: baseBody,
                whenText: "next available slot",
                attendeesText: segment,
            };
        case "send_email":
            return {
                subject: `${parentTask.title} invite`,
                body: baseBody,
                to: [],
            };
        case "create_github_issue":
            return {
                title: parentTask.title,
                body: baseBody,
                labels: ["planned"],
            };
        default:
            return {};
    }
}

function planSubTasks(task: ITask): PlannedSubTask[] {
    const searchableText = `${task.title} ${task.description}`.trim();
    const segments = splitSequentialSegments(searchableText);

    if (segments.length < 2) {
        return [];
    }

    const actions = segments
        .map((segment) => ({ segment, actionType: detectAction(segment) }))
        .filter((entry) => entry.actionType !== "none");

    if (actions.length < 2) {
        return [];
    }

    return actions.map(({ segment, actionType }) => ({
        title: buildSubTaskTitle(actionType, segment),
        description: segment,
        actionType,
        parameters: buildSubTaskParameters(actionType, task, segment),
    }));
}

export class TaskPlanner {
    async planTask(taskId: string): Promise<TaskPlanResult> {
        const task = await TaskModel.findById(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }

        if (Array.isArray(task.subTasks) && task.subTasks.length > 0) {
            return {
                parentTaskId: taskId,
                subTaskIds: task.subTasks.map((subTaskId) => subTaskId.toString()),
                planned: false,
            };
        }

        const latestAction = await getLatestExecutionTaskAction(taskId);
        const subTaskPlan = planSubTasks(task);

        if (subTaskPlan.length === 0) {
            return {
                parentTaskId: taskId,
                subTaskIds: [],
                planned: false,
            };
        }

        const subTaskIds: string[] = [];
        const parentObjectId = new Types.ObjectId(taskId);
        const sourceMessageIds = task.sourceMessageIds.map((id) => id.toString());
        const latestContextMessageId = task.latestContextMessageId ? task.latestContextMessageId.toString() : null;
        let previousSubTaskId: string | null = null;

        for (const step of subTaskPlan) {
            const nextTask = await createTask({
                conversationId: task.conversationId.toString(),
                parentTaskId: parentObjectId.toString(),
                title: step.title,
                description: step.description,
                assignees: task.assignees.map((assignee) => assignee.toString()),
                dueAt: task.dueAt ? new Date(task.dueAt) : null,
                priority: task.priority,
                source: task.source,
                sourceMessageIds,
                latestContextMessageId,
                confidence: Math.min(1, task.confidence),
                tags: [...task.tags],
                dedupeKey: `${task.dedupeKey}::subtask::${subTaskIds.length + 1}`,
                subTasks: [],
                dependencyIds: previousSubTaskId ? [previousSubTaskId] : [],
                progress: 0,
                checkpoints: [],
                executionHistory: {
                    attempts: 0,
                    failures: 0,
                    results: [],
                },
                createdBy: task.createdBy.toString(),
            });

            const executionParameters = {
                ...step.parameters,
                parentTaskId: taskId,
                subTaskIndex: subTaskIds.length,
            };

            await createTaskAction({
                taskId: nextTask._id.toString(),
                conversationId: task.conversationId.toString(),
                actorType: "agent",
                actorId: null,
                actionType: step.actionType,
                messageId: latestAction?.messageId ? latestAction.messageId.toString() : null,
                parameters: executionParameters,
                executionState: "requested",
                summary: `Planned subtask: ${step.title}`,
                error: null,
                patch: {
                    before: null,
                    after: {
                        actionType: step.actionType,
                        parameters: executionParameters,
                        parentTaskId: taskId,
                    },
                },
                reason: "Planner generated subtask",
                idempotencyKey: buildTaskActionIdempotencyKey(
                    nextTask._id.toString(),
                    `requested:${step.actionType}`,
                    taskId
                ),
            });

            subTaskIds.push(nextTask._id.toString());
            previousSubTaskId = nextTask._id.toString();
        }

        await updateTask({
            taskId,
            status: "executing",
            subTasks: subTaskIds,
        });

        return {
            parentTaskId: taskId,
            subTaskIds,
            planned: true,
        };
    }

    async getSubTasks(parentTaskId: string): Promise<ITask[]> {
        return TaskModel.find({ parentTaskId: new Types.ObjectId(parentTaskId) })
            .sort({ createdAt: 1 })
            .exec();
    }

    async getNextExecutableTasks(parentTaskId: string): Promise<ITask[]> {
        const children = await this.getSubTasks(parentTaskId);

        const completed = new Set(
            children
                .filter((task) => task.status === "completed")
                .map((task) => task._id.toString())
        );

        return children.filter((task) => {
            if (task.status !== "pending" && task.status !== "executing") {
                return false;
            }

            const dependencies = (task.dependencyIds || []).map((id) => id.toString());
            return dependencies.every((dependencyId) => completed.has(dependencyId));
        });
    }
}

export default TaskPlanner;
