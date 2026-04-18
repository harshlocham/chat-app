import mongoose, { Model, Schema } from "mongoose";

export type TaskStatus = "pending" | "executing" | "completed" | "failed" | "partial";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskSource = "ai" | "manual" | "imported";

export interface ITask {
    _id: mongoose.Types.ObjectId;
    conversationId: mongoose.Types.ObjectId;
    parentTaskId?: mongoose.Types.ObjectId | null;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignees: mongoose.Types.ObjectId[];
    dueAt?: Date | null;
    createdBy: mongoose.Types.ObjectId;
    source: TaskSource;
    sourceMessageIds: mongoose.Types.ObjectId[];
    latestContextMessageId?: mongoose.Types.ObjectId | null;
    confidence: number;
    tags: string[];
    dedupeKey: string;
    subTasks: mongoose.Types.ObjectId[];
    dependencyIds: mongoose.Types.ObjectId[];
    retryCount: number;
    maxRetries: number;
    progress: number;
    checkpoints: Array<{
        step: string;
        status: string;
        timestamp: Date;
    }>;
    executionHistory: {
        attempts: number;
        failures: number;
        results: Array<{
            attempt: number;
            success: boolean;
            summary: string;
            error?: string;
            timestamp: Date;
        }>;
    };
    result: {
        success: boolean;
        confidence: number;
        evidence: unknown;
        error?: string;
    };
    closedAt?: Date | null;
    archivedAt?: Date | null;
    updatedBy?: mongoose.Types.ObjectId | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
    {
        conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
        title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
        description: { type: String, trim: true, maxlength: 8000, default: "" },
        status: {
            type: String,
            enum: ["pending", "executing", "completed", "failed", "partial"],
            default: "pending",
            index: true,
        },
        priority: {
            type: String,
            enum: ["low", "medium", "high", "urgent"],
            default: "medium",
            index: true,
        },
        assignees: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
        dueAt: { type: Date, default: null, index: true },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        source: { type: String, enum: ["ai", "manual", "imported"], required: true, index: true },
        parentTaskId: { type: Schema.Types.ObjectId, ref: "Task", default: null, index: true },
        sourceMessageIds: [{ type: Schema.Types.ObjectId, ref: "Message" }],
        latestContextMessageId: { type: Schema.Types.ObjectId, ref: "Message", default: null },
        confidence: { type: Number, min: 0, max: 1, default: 1 },
        tags: [{ type: String, trim: true, maxlength: 48 }],
        dedupeKey: { type: String, required: true, maxlength: 160, unique: true },
        subTasks: { type: [{ type: Schema.Types.ObjectId, ref: "Task" }], default: [] },
        dependencyIds: { type: [{ type: Schema.Types.ObjectId, ref: "Task" }], default: [] },
        retryCount: { type: Number, min: 0, default: 0 },
        maxRetries: { type: Number, min: 0, default: 2 },
        progress: { type: Number, min: 0, max: 100, default: 0 },
        checkpoints: {
            type: [{
                step: { type: String, required: true, trim: true, maxlength: 120 },
                status: { type: String, required: true, trim: true, maxlength: 40 },
                timestamp: { type: Date, required: true, default: Date.now },
            }],
            default: [],
        },
        executionHistory: {
            attempts: { type: Number, min: 0, default: 0 },
            failures: { type: Number, min: 0, default: 0 },
            results: {
                type: [{
                    attempt: { type: Number, min: 1, required: true },
                    success: { type: Boolean, required: true },
                    summary: { type: String, trim: true, maxlength: 1200, required: true },
                    error: { type: String, trim: true, maxlength: 4000, default: undefined },
                    timestamp: { type: Date, required: true, default: Date.now },
                }],
                default: [],
            },
        },
        result: {
            success: { type: Boolean, default: false },
            confidence: { type: Number, min: 0, max: 1, default: 0 },
            evidence: { type: Schema.Types.Mixed, default: null },
            error: { type: String, trim: true, maxlength: 4000, default: undefined },
        },
        closedAt: { type: Date, default: null },
        archivedAt: { type: Date, default: null },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    {
        timestamps: true,
        versionKey: "version",
        optimisticConcurrency: true,
    }
);

TaskSchema.path("assignees").validate((assignees: mongoose.Types.ObjectId[]) => assignees.length <= 32, "Too many assignees.");

TaskSchema.pre("save", function (next) {
    if (this.status === "completed" || this.status === "failed") {
        if (!this.closedAt) this.closedAt = new Date();
    } else {
        this.closedAt = null;
    }

    next();
});

TaskSchema.index({ conversationId: 1, status: 1, updatedAt: -1 });
TaskSchema.index({ conversationId: 1, dueAt: 1, status: 1 });
TaskSchema.index({ assignees: 1, status: 1, dueAt: 1 });
TaskSchema.index({ parentTaskId: 1, status: 1, updatedAt: -1 });
TaskSchema.index({ parentTaskId: 1, dependencyIds: 1 });
TaskSchema.index({ status: 1, progress: 1, updatedAt: -1 });
TaskSchema.index({ sourceMessageIds: 1 });
TaskSchema.index({ updatedAt: -1 });

const TaskModel: Model<ITask> =
    (mongoose.models.Task as Model<ITask>) || mongoose.model<ITask>("Task", TaskSchema);

export default TaskModel;