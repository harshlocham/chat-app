import mongoose, { Schema, model, Document, Types, Model } from "mongoose";


export interface IUser extends Document {
    _id: mongoose.Types.ObjectId
    username: string;
    email: string;
    password: string;
    isOnline: boolean;
    profilePicture?: string;
    role: 'user' | 'moderator' | 'admin';
    status: 'active' | 'banned';
    lastSeen: Date;
    isVerified: Date;
    twoFactorEnabled: boolean;
    twoFactorSecret: string;
    conversations: Types.ObjectId[];
}

const userSchema = new Schema<IUser>({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false }, // Optional for OAuth users
    profilePicture: { type: String },
    isOnline: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'banned'], default: 'active' },
    role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
    lastSeen: { type: Date, default: Date.now },
    isVerified: { type: Date },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String },
    conversations: [{ type: Schema.Types.ObjectId, ref: 'Conversation' }],
},
    { timestamps: true },
);

export const User: Model<IUser> =
    (mongoose.models.User as Model<IUser>) || model<IUser>("User", userSchema);