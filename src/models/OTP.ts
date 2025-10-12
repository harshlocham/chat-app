// models/Otp.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IOtp extends Document {
    email: string;
    otp: string;
    createdAt: Date;
}

const OtpSchema = new Schema<IOtp>({
    email: { type: String, required: true },
    otp: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 600 }, // OTP expires in 10 minutes
});

export default mongoose.models.Otp || mongoose.model<IOtp>("Otp", OtpSchema);