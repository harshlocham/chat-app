import { Schema, model, models, Document, Types } from "mongoose";

export interface IDevice extends Document {
    userId: Types.ObjectId;
    deviceName: string;
    userAgent: string;
    ipAddress: string;
    sessionToken: string;
    createdAt: Date;
    lastActiveAt: Date;
}
const deviceSchema = new Schema<IDevice>({
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    deviceName: { type: String, required: true },
    userAgent: { type: String, required: true },
    ipAddress: { type: String, required: true },
    sessionToken: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
});
export const Devices = models.deviceSchema || model<IDevice>("Devices", deviceSchema);