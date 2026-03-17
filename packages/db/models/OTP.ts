// models/Otp.ts
import mongoose, { Schema, Document, Model } from "mongoose";

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

const OtpModel: Model<IOtp> =
    (mongoose.models.Otp as Model<IOtp>) || mongoose.model<IOtp>("Otp", OtpSchema);

export default OtpModel;