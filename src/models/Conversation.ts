// models/Conversation.ts
import mongoose, { Schema, model, models, Document, Types } from 'mongoose';
import { IUser } from './User';

export interface ILastMessage {
    _id: Types.ObjectId;
    sender: Types.ObjectId;
    messageType: 'text' | 'image' | 'video' | 'file' | 'system';
    content?: string;
    _creationTime: Date;
}

export interface IConversation extends Document {
    _id: mongoose.Types.ObjectId
    _creationTime: Date | undefined;
    admin: string
    participants: IUser[];
    type: 'direct' | 'group';
    isGroup: boolean;
    isOnline?: boolean; // handled by socket but used in UI
    name?: string;       // direct message name
    image: string | undefined;      // direct message image
    groupName?: string;
    lastMessage?: ILastMessage;
    createdAt: Date;     // alias as _creationTime
    updatedAt: Date;
}


const conversationSchema = new Schema<IConversation>({
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    type: { type: String, enum: ['direct', 'group'], default: 'direct' },
    isGroup: { type: Boolean, default: false },
    admin: { type: String },
    name: { type: String },         // direct name fallback
    image: { type: String || undefined },        // direct image fallback
    groupName: { type: String },
    isOnline: { type: Boolean, default: false }, // not stored permanently, updated via socket
    lastMessage: {
        _id: { type: Schema.Types.ObjectId, ref: 'Message' },
        sender: { type: Schema.Types.ObjectId, ref: 'User' },
        messageType: {
            type: String,
            enum: ['text', 'image', 'video', 'file', 'system']
        },
        content: { type: String },
        _creationTime: { type: Date }
    }
}, {
    timestamps: true // gives you createdAt and updatedAt
});


export const Conversation = models.Conversation || model<IConversation>('Conversation', conversationSchema);
