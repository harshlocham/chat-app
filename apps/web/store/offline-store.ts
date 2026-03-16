import { create } from "zustand";
import { offlineDB, OfflineMessage } from "@/lib/Db/offlineMessages";

interface OfflineStore {
    offlineQueue: OfflineMessage[];
    addToQueue: (msg: OfflineMessage) => Promise<void>;
    removeFromQueue: (tempId: string) => Promise<void>;
    loadQueue: () => Promise<void>;
}
export const useOfflineStore = create<OfflineStore>((set, get) => ({
    offlineQueue: [],

    addToQueue: async (msg) => {
        await offlineDB.offlineMessages.add(msg);
        set({ offlineQueue: [...get().offlineQueue, msg] });
    },

    removeFromQueue: async (tempId) => {
        const existing = await offlineDB.offlineMessages
            .where("tempId")
            .equals(tempId)
            .first();
        if (existing?.id) {
            await offlineDB.offlineMessages.delete(existing.id);
        }
        set({
            offlineQueue: get().offlineQueue.filter((msg) => msg.tempId !== tempId),
        })
    },
    loadQueue: async () => {
        const messages = await offlineDB.offlineMessages.toArray();
        set({ offlineQueue: messages });
    },

}))