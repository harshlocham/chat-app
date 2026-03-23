import mongoose, { model, Model, Schema, Types } from "mongoose";

export interface ISession extends mongoose.Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    refreshTokenHash: string;
    userAgent: string;
    ipAddress: string;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    lastActiveAt: Date;
}

const sessionSchema = new Schema<ISession>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        refreshTokenHash: { type: String, required: true, select: false },
        userAgent: { type: String, required: true, default: "Unknown" },
        ipAddress: { type: String, required: true, default: "Unknown" },
        expiresAt: { type: Date, required: true },
        revokedAt: { type: Date, default: null },
        lastActiveAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel: Model<ISession> =
    (mongoose.models.AuthSession as Model<ISession>) ||
    model<ISession>("AuthSession", sessionSchema);
