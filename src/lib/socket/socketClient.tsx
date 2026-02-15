"use client";

import { io, Socket } from "socket.io-client";
import {
    type ServerToClientEvents,
    type ClientToServerEvents,
    // SocketEvents,
} from "@/shared/types/SocketEvents";
import useChatStore from "@/store/chat-store";

// You can configure this in .env.local
const SOCKET_URL =
    process.env.NEXT_PUBLIC_SOCKET_URL || undefined; // undefined = same origin

let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null =
    null;

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Create (once) and return the singleton socket instance.
 * Safe to call from client components.
 */
export function getSocket(): TypedSocket {
    if (!socketInstance) {
        socketInstance = io(SOCKET_URL, {
            path: "/api/socket",
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
 * Optional helper: connect with auth token (if you use JWT/header auth)
 */
export function connectSocket(authToken?: string) {
    const s = getSocket();

    if (authToken) {
        s.io.opts.extraHeaders = {
            ...(s.io.opts.extraHeaders || {}),
            Authorization: `Bearer ${authToken}`,
        };
    }

    if (!s.connected) {
        s.connect();
    }
}

/**
 * Optional helper: disconnect socket
 */
export function disconnectSocket() {
    const s = getSocket();
    if (s.connected) {
        s.disconnect();
    }
}
let listenersRegistered = false;
export function registerGlobalSocketListeners() {
    if (listenersRegistered) return;
    listenersRegistered = true;

    socket.on("message:new", (payload) => {
        useChatStore.getState().receiveMessage({
            conversationId: String(payload.conversationId),
            message: payload.message,
        });
    });

    // (future) typing, presence, edits, deletes
}