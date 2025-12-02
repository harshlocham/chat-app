// src/lib/socketClient.ts
import { io, Socket } from "socket.io-client";

// Create and export a single socket instance
export const socket: Socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
    transports: ["websocket"],
    withCredentials: true,
    autoConnect: false,
});
