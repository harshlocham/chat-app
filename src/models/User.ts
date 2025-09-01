import mongoose, { Schema, model, models, Document, Types } from "mongoose";


export interface IUser extends Document {
    _id: mongoose.Types.ObjectId
    username: string;
    email: string;
    password: string;
    isOnline: boolean;
    profilePicture?: string;
    status: 'online' | 'offline' | 'busy';
    lastSeen: Date;
    isVerified: boolean;
    conversations: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false }, // Optional for OAuth users
    profilePicture: { type: String },
    isOnline: { type: Boolean, default: false },
    status: { type: String, enum: ['online', 'offline', 'busy'], default: 'offline' },
    lastSeen: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: false },
    conversations: [{ type: Schema.Types.ObjectId, ref: 'Conversation' }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export const User = models.User || model<IUser>("User", userSchema);