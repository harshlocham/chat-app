import { socket } from '@/lib/socketClient';
import { useOfflineStore } from '@/store/offline-store';

export function initSocketHandlers() {
    const { offlineQueue, removeFromQueue, loadQueue } = useOfflineStore.getState();

    socket.on('connect', async () => {
        console.log('Socket reconnected. Retrying offline messages...');
        await loadQueue();
        const messages = useOfflineStore.getState().offlineQueue;

        for (const msg of messages) {
            socket.emit('sendMessage', msg, async (ack: any) => {
                if (ack?.success) {
                    await removeFromQueue(msg.tempId);
                    console.log('Resent successfully:', msg.tempId);
                } else {
                    console.warn('Retry failed:', msg.tempId);
                }
            });
        }
    });
}