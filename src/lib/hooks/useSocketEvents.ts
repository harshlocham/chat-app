"use client";

import { io, Socket } from "socket.io-client";
import type {
    ServerToClientEvents,
    ClientToServerEvents,
} from "@/server/socket/types/SocketEvents";

// You can configure this in .env.local
// NEXT_PUBLIC_SOCKET_URL can be like: "http://localhost:3000" or separate socket server URL
const SOCKET_URL =
    process.env.NEXT_PUBLIC_SOCKET_URL || undefined; // undefined = same origin

let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null =
    null;

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Return the singleton socket instance, creating it on first call.
 *
 * Safe to call from client components.
 *
 * @returns The singleton socket used for client-side Socket.IO communication
 */
export function getSocket(): TypedSocket {
    if (!socketInstance) {
        socketInstance = io(SOCKET_URL, {
            path: "/api/socket", // your pages/api/socket.ts
            autoConnect: false, // you control when to connect
            transports: ["websocket"], // prefer ws
            withCredentials: true,
        });
    }

    return socketInstance;
}

/**
 * Backwards-compatible export if you were doing:
 *   import { socket } from "@/lib/socketClient";
 *
 * NOTE: Only use this inside "use client" components.
 */
export const socket = getSocket();

/**
 * Connects the singleton socket and, if provided, attaches a JWT token to the socket's `auth` payload.
 *
 * @param authToken - Optional JWT or bearer token to include as `token` in the socket's `auth` object before connecting
 */
export function connectSocket(authToken?: string) {
    const s = getSocket();

    if (authToken) {
        s.auth = {
            ...(s.auth || {}),
            token: authToken,
        };
    }

    if (!s.connected) {
        s.connect();
    }
}

/**
 * Disconnects the module's singleton socket if it is currently connected.
 *
 * Does nothing when the socket is already disconnected.
 */
export function disconnectSocket() {
    const s = getSocket();
    if (s.connected) {
        s.disconnect();
    }
}