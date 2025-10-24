"use client";

import { useEffect, useRef } from "react";
import { useOfflineStore } from "@/store/offline-store";
import { useNetworkStatus } from "./useNetworkStatus";
import { socket } from "@/lib/socketClient";
import { useConversationStore } from "@/store/chat-store"; // adjust import path
import toast from "react-hot-toast";

export function useOfflineMessageSync() {
    const isOnline = useNetworkStatus();
    const { offlineQueue, loadQueue, removeFromQueue } = useOfflineStore();
    const isResending = useRef(false);
    const { replaceTempMessage } = useConversationStore();

    // Load messages from IndexedDB once
    useEffect(() => {
        loadQueue();
    }, [loadQueue]);

    useEffect(() => {
        if (!isOnline || socket.disconnected || isResending.current) return;
        if (offlineQueue.length === 0) return;

        const resendQueuedMessages = async () => {
            isResending.current = true;
            console.log("[OfflineSync] Starting queued message resend...");

            for (const msg of offlineQueue) {
                let success = false;
                let delay = 1000; // start at 1 second
                const maxRetries = 5;

                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        const res = await fetch("/api/messages", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                content: msg.content,
                                conversationId: msg.conversationId,
                                senderId: msg.senderId,
                            }),
                        });

                        if (!res.ok) throw new Error("Failed to send message");

                        const savedMsg = await res.json();
                        socket.emit("message:send", savedMsg);
                        replaceTempMessage(msg.tempId, savedMsg);
                        await removeFromQueue(msg.tempId);

                        console.log(`[OfflineSync] Sent message ${msg.tempId}`);
                        success = true;
                        break;
                    } catch (err) {
                        console.warn(
                            `[OfflineSync] Attempt ${attempt} failed for ${msg.tempId}`,
                            err
                        );
                        if (attempt < maxRetries) {
                            await new Promise((res) => setTimeout(res, delay));
                            delay *= 2; // exponential backoff
                        }
                    }
                }

                if (!success) {
                    console.error(
                        `[OfflineSync] Giving up after ${maxRetries} attempts for ${msg.tempId}`
                    );
                }
            }

            toast.success("Offline messages sent successfully ✅");
            isResending.current = false;
        };

        resendQueuedMessages();
    }, [isOnline, offlineQueue, removeFromQueue, replaceTempMessage]);
}