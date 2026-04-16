import mongoose, { Model, Schema } from "mongoose";

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

export interface ITaskAction {
    _id: mongoose.Types.ObjectId;
    taskId: mongoose.Types.ObjectId;
    conversationId: mongoose.Types.ObjectId;
    actorType: TaskActorType;
    actorId?: mongoose.Types.ObjectId | null;
    actionType: TaskActionType;
    messageId?: mongoose.Types.ObjectId | null;
    patch: {
        before: unknown | null;
        after: unknown | null;
    };
    reason: string;
    idempotencyKey: string;
    createdAt: Date;
}

const TaskActionSchema = new Schema<ITaskAction>(
    {
        taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
        conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
        actorType: { type: String, enum: ["user", "agent", "system"], required: true },
        actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
        actionType: {
            type: String,
            enum: [
                "created",
                "reassigned",
                "status_changed",
                "priority_changed",
                "due_changed",
                "linked_message",
                "unlinked_message",
                "commented",
                "ai_reclassified",
            ],
            required: true,
            index: true,
        },
        messageId: { type: Schema.Types.ObjectId, ref: "Message", default: null, index: true },
        patch: {
            before: { type: Schema.Types.Mixed, default: null },
            after: { type: Schema.Types.Mixed, default: null },
        },
        reason: { type: String, trim: true, maxlength: 2000, default: "" },
        idempotencyKey: { type: String, required: true, maxlength: 160, unique: true },
        createdAt: { type: Date, default: Date.now, index: true },
    },
    { timestamps: false, strict: true }
);

TaskActionSchema.index({ taskId: 1, createdAt: 1 });
TaskActionSchema.index({ conversationId: 1, createdAt: -1 });

const TaskActionModel: Model<ITaskAction> =
    (mongoose.models.TaskAction as Model<ITaskAction>) || mongoose.model<ITaskAction>("TaskAction", TaskActionSchema);

export default TaskActionModel;