"use client";

import { create } from "zustand";
import type {
    MessageSemanticUpdatedPayload,
    TaskCreatedPayload,
    TaskLinkedToMessagePayload,
    TaskRecord,
    TaskUpdatedPayload,
} from "@chat/types";

interface TaskLinkState {
    taskId: string;
    messageId: string;
    linkType: "source" | "context" | "decision";
    taskVersion: number;
}

interface TaskStore {
    tasksById: Record<string, TaskRecord>;
    tasksByConversation: Record<string, string[]>;
    linksByMessageId: Record<string, TaskLinkState>;
    semanticByMessageId: Record<string, MessageSemanticUpdatedPayload>;

    upsertTask: (task: TaskRecord) => void;
    patchTask: (payload: TaskUpdatedPayload) => void;
    linkTaskToMessage: (payload: TaskLinkedToMessagePayload) => void;
    setMessageSemanticState: (payload: MessageSemanticUpdatedPayload) => void;
    removeTask: (taskId: string) => void;
    resetConversationTasks: (conversationId: string) => void;
    handleTaskCreated: (payload: TaskCreatedPayload) => void;
}

const upsertConversationTaskId = (current: string[], taskId: string) => {
    if (current.includes(taskId)) return current;
    return [...current, taskId];
};

const removeConversationTaskId = (current: string[], taskId: string) => current.filter((entry) => entry !== taskId);

const useTaskStore = create<TaskStore>((set, get) => ({
    tasksById: {},
    tasksByConversation: {},
    linksByMessageId: {},
    semanticByMessageId: {},

    upsertTask: (task) =>
        set((state) => ({
            tasksById: {
                ...state.tasksById,
                [task._id]: task,
            },
            tasksByConversation: {
                ...state.tasksByConversation,
                [task.conversationId]: upsertConversationTaskId(
                    state.tasksByConversation[task.conversationId] || [],
                    task._id
                ),
            },
        })),

    patchTask: (payload) =>
        set((state) => {
            const existing = state.tasksById[payload.taskId];
            if (!existing) return {};
            if (existing.version >= payload.newVersion) return {};

            const nextTask: TaskRecord = {
                ...existing,
                ...payload.patch,
                version: payload.newVersion,
                updatedAt: new Date().toISOString(),
            };

            return {
                tasksById: {
                    ...state.tasksById,
                    [payload.taskId]: nextTask,
                },
                tasksByConversation: {
                    ...state.tasksByConversation,
                    [payload.conversationId]: upsertConversationTaskId(
                        state.tasksByConversation[payload.conversationId] || [],
                        payload.taskId
                    ),
                },
            };
        }),

    linkTaskToMessage: (payload) =>
        set((state) => ({
            linksByMessageId: {
                ...state.linksByMessageId,
                [payload.messageId]: {
                    taskId: payload.taskId,
                    messageId: payload.messageId,
                    linkType: payload.linkType,
                    taskVersion: payload.taskVersion,
                },
            },
            tasksByConversation: {
                ...state.tasksByConversation,
                [payload.conversationId]: upsertConversationTaskId(
                    state.tasksByConversation[payload.conversationId] || [],
                    payload.taskId
                ),
            },
        })),

    setMessageSemanticState: (payload) =>
        set((state) => ({
            semanticByMessageId: {
                ...state.semanticByMessageId,
                [payload.messageId]: payload,
            },
        })),

    removeTask: (taskId) =>
        set((state) => {
            const existing = state.tasksById[taskId];
            if (!existing) return {};

            const nextTasksById = { ...state.tasksById };
            delete nextTasksById[taskId];

            const nextTasksByConversation = {
                ...state.tasksByConversation,
                [existing.conversationId]: removeConversationTaskId(
                    state.tasksByConversation[existing.conversationId] || [],
                    taskId
                ),
            };

            return {
                tasksById: nextTasksById,
                tasksByConversation: nextTasksByConversation,
            };
        }),

    resetConversationTasks: (conversationId) =>
        set((state) => ({
            tasksByConversation: {
                ...state.tasksByConversation,
                [conversationId]: [],
            },
        })),

    handleTaskCreated: (payload) =>
        get().upsertTask(payload.task),
}));

export default useTaskStore;