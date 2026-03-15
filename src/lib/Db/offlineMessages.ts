import Dexie from 'dexie';

export interface OfflineMessage {
    id?: number; // auto increment
    tempId: string; // unique client-side id
    conversationId: string;
    conversationMembers?: string[];
    content: string;
    messageType: string;
    createdAt: string | Date;
    senderId: string;
    status: string;
}

class OfflineMessageDB extends Dexie {
    offlineMessages!: Dexie.Table<OfflineMessage, number>;

    constructor() {
        super('OfflineMessageDB');
        this.version(1).stores({
            offlineMessages: '++id,tempId,conversationId,timestamp'
        });
    }
}

export const offlineDB = new OfflineMessageDB();