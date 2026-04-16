import mongoose, { Model, Schema } from "mongoose";

export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "canceled";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskSource = "ai" | "manual" | "imported";

export interface ITask {
    _id: mongoose.Types.ObjectId;
    conversationId: mongoose.Types.ObjectId;
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
            enum: ["open", "in_progress", "blocked", "done", "canceled"],
            default: "open",
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
        sourceMessageIds: [{ type: Schema.Types.ObjectId, ref: "Message" }],
        latestContextMessageId: { type: Schema.Types.ObjectId, ref: "Message", default: null },
        confidence: { type: Number, min: 0, max: 1, default: 1 },
        tags: [{ type: String, trim: true, maxlength: 48 }],
        dedupeKey: { type: String, required: true, maxlength: 160, unique: true },
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
    if (this.status === "done" || this.status === "canceled") {
        if (!this.closedAt) this.closedAt = new Date();
    } else {
        this.closedAt = null;
    }

    next();
});

TaskSchema.index({ conversationId: 1, status: 1, updatedAt: -1 });
TaskSchema.index({ conversationId: 1, dueAt: 1, status: 1 });
TaskSchema.index({ assignees: 1, status: 1, dueAt: 1 });
TaskSchema.index({ sourceMessageIds: 1 });
TaskSchema.index({ updatedAt: -1 });

const TaskModel: Model<ITask> =
    (mongoose.models.Task as Model<ITask>) || mongoose.model<ITask>("Task", TaskSchema);

export default TaskModel;