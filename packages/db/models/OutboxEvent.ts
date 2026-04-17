import mongoose, { Model, Schema } from "mongoose";

export type OutboxTopic = "message.created" | "task.execution.requested";

export type OutboxStatus = "pending" | "processing" | "completed" | "failed";

export interface IOutboxEvent {
    _id: mongoose.Types.ObjectId;
    topic: OutboxTopic;
    dedupeKey: string;
    payload: Record<string, unknown>;
    status: OutboxStatus;
    attempts: number;
    availableAt: Date;
    lockedBy?: string | null;
    lockedAt?: Date | null;
    processedAt?: Date | null;
    lastError?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const OutboxEventSchema = new Schema<IOutboxEvent>(
    {
        topic: {
            type: String,
            enum: ["message.created", "task.execution.requested"],
            required: true,
            index: true,
        },
        dedupeKey: { type: String, required: true, unique: true, maxlength: 200 },
        payload: { type: Schema.Types.Mixed, required: true },
        status: {
            type: String,
            enum: ["pending", "processing", "completed", "failed"],
            default: "pending",
            index: true,
        },
        attempts: { type: Number, default: 0, min: 0 },
        availableAt: { type: Date, default: Date.now, index: true },
        lockedBy: { type: String, default: null },
        lockedAt: { type: Date, default: null },
        processedAt: { type: Date, default: null },
        lastError: { type: String, default: null, maxlength: 4000 },
    },
    {
        timestamps: true,
    }
);

OutboxEventSchema.index({ status: 1, availableAt: 1, createdAt: 1 });
OutboxEventSchema.index({ topic: 1, status: 1, createdAt: 1 });

const OutboxEventModel: Model<IOutboxEvent> =
    (mongoose.models.OutboxEvent as Model<IOutboxEvent>)
    || mongoose.model<IOutboxEvent>("OutboxEvent", OutboxEventSchema);

export default OutboxEventModel;