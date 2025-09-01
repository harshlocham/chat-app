// lib/stores/useSocketStore.ts
import { create } from "zustand";
import { io, Socket } from "socket.io-client";

interface SocketStore {
    socket: Socket | null;
    onlineUsers: Set<string>;
    initSocket: (userId: string) => void;
}

export const useSocketStore = create<SocketStore>((set) => ({
    socket: null,
    onlineUsers: new Set(),

    initSocket: (userId: string) => {
        const socket = io("http://localhost:3001", {
            query: { userId },
        });

        socket.on("connect", () => {
            console.log("✅ Connected to socket:", socket.id);
        });

        socket.on("disconnect", () => {
            console.log("🔌 Disconnected from socket");
        });

        socket.on("user:online", (userId: string) => {
            set((state) => {
                const updated = new Set(state.onlineUsers);
                updated.add(userId);
                return { onlineUsers: updated };
            });
        });

        socket.on("user:offline", (userId: string) => {
            set((state) => {
                const updated = new Set(state.onlineUsers);
                updated.delete(userId);
                return { onlineUsers: updated };
            });
        });

        set({ socket });
    },
}));
