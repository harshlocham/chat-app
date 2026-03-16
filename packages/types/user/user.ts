
export interface ClientUser {
    _id: string;
    username: string;
    email: string;
    isOnline: boolean;
    profilePicture?: string;
    role: 'user' | 'moderator' | 'admin';
    status: 'active' | 'banned';
    lastSeen: string;
    isVerified: boolean;
    verifiedAt?: string;
    conversations: string[]; // Only store conversation IDs for FE
    createdAt: string;
    updatedAt: string;
}