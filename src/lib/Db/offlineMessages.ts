import Dexie from 'dexie';

export interface OfflineMessage {
    id?: number; // auto increment
    tempId: string; // unique client-side id
    conversationId: string;
    content: string;
    messageType: string;
    timestamp: string | Date;
    senderId: string;
}

class OfflineMessageDB extends Dexie {
    offlineMessages!: Dexie.Table<OfflineMessage, number>;

    constructor() {
        super('OfflineMessageDB');
        this.version(1).stores({
            offlineMessages: '++id,tempId,conversationId,createdAt'
        });
    }
}

export const offlineDB = new OfflineMessageDB();