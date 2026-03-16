"use client";

import { io, Socket } from "socket.io-client";
import {
    type MessageDTO,
    type ServerToClientEvents,
    type ClientToServerEvents,
    SocketEvents,
    type TypingPayload,
    // SocketEvents,
} from "@chat/types";
import useChatStore from "@/store/chat-store";
import { isMessageDTO } from "@chat/types/utils/message.guard";
import { UIMessage } from "@chat/types";
import { getClientSocketUrl } from "@/lib/socket/socketConfig";

let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null =
    null;
const typingExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Create (once) and return the singleton socket instance.
 * Safe to call from client components.
 */
export function getSocket(): TypedSocket {
    if (!socketInstance) {
        socketInstance = io(getClientSocketUrl(), {
            path: "/api/socket",
            autoConnect: false, // you control when to connect
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 7000,
            timeout: 20000,
            closeOnBeforeunload: true,
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

    socket.on(SocketEvents.MESSAGE_NEW, (dto: unknown) => {
        if (!isMessageDTO(dto)) {
            console.error("Invalid MESSAGE_NEW payload:", dto);
            return;
        }

        const uiMessage = convertDTOToUI(dto);

        useChatStore.getState().receiveMessage(uiMessage);
    });
    socket.on(SocketEvents.MESSAGE_DELETE, (payload: MessageDTO) => {
        console.log("🔌 MESSAGE_DELETE", payload);
        useChatStore.getState().updateDeletedMessage(convertDTOToUI(payload));
    });
    socket.on(SocketEvents.MESSAGE_REACTION, (dto) => {
        if (!isMessageDTO(dto)) return;

        const uiMessage = convertDTOToUI(dto);
        useChatStore.getState().updateMessage(uiMessage);
    });

    const typingKey = (payload: TypingPayload) =>
        `${String(payload.conversationId)}:${String(payload.userId)}`;

    const clearTypingTimer = (key: string) => {
        const timer = typingExpiryTimers.get(key);
        if (!timer) return;
        clearTimeout(timer);
        typingExpiryTimers.delete(key);
    };

    socket.on(SocketEvents.TYPING_START, (payload: TypingPayload) => {
        if (!payload?.conversationId || !payload?.userId) return;

        useChatStore.getState().setTyping(payload.conversationId, payload.userId, true);

        const key = typingKey(payload);
        clearTypingTimer(key);

        const timer = setTimeout(() => {
            useChatStore
                .getState()
                .setTyping(payload.conversationId, payload.userId, false);
            typingExpiryTimers.delete(key);
        }, 4500);

        typingExpiryTimers.set(key, timer);
    });

    socket.on(SocketEvents.TYPING_STOP, (payload: TypingPayload) => {
        if (!payload?.conversationId || !payload?.userId) return;

        useChatStore.getState().setTyping(payload.conversationId, payload.userId, false);
        clearTypingTimer(typingKey(payload));
    });
}

function convertDTOToUI(dto: MessageDTO): UIMessage {
    if (!dto.sender || !dto.sender._id) {
        throw new Error("Invalid DTO: missing sender");
    }

    const status: UIMessage["status"] = dto.seen || (dto.seenBy?.length ?? 0) > 0
        ? "seen"
        : dto.delivered || (dto.deliveredTo?.length ?? 0) > 0
            ? "delivered"
            : "sent";

    return {
        ...dto,
        createdAt: new Date(dto.createdAt),
        updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : undefined,
        status,
        isTemp: false,
    };
}