"use client";

import { io, Socket } from "socket.io-client";
import {
    type ServerToClientEvents,
    type ClientToServerEvents,
    SocketEvents,
} from "@/server/socket/types/SocketEvents";
import useChatStore from "@/store/chat-store";
import { IMessagePopulated, MessageType } from "@/models/Message";
import { ITempMessage } from "@/models/TempMessage";

// You can configure this in .env.local
const SOCKET_URL =
    process.env.NEXT_PUBLIC_SOCKET_URL || undefined; // undefined = same origin

let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null =
    null;

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Return the application's singleton Socket.io client instance.
 *
 * The instance is created lazily on first call and configured to use the app's socket endpoint.
 *
 * @returns The singleton Socket.io client instance
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
 * Ensures the singleton socket is connected and, if provided, attaches a Bearer authorization header.
 *
 * @param authToken - Optional JWT or token string to set as `Authorization: Bearer <token>` in the socket's extra headers
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
 * Disconnects the singleton socket client if it is currently connected.
 */
export function disconnectSocket() {
    const s = getSocket();
    if (s.connected) {
        s.disconnect();
    }
}
let listenersRegistered = false;
/**
 * Registers global socket event handlers used by the client.
 *
 * Ensures handlers are attached only once; currently listens for `message:new`
 * and forwards incoming payloads to the chat store via `receiveMessage`
 * (converting `conversationId` to a string). Future events may include typing,
 * presence, edits, and deletes.
 */
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