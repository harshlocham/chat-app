// src/server/socket/handlers/typing/typing.handler.ts
import type { Server as IOServer } from "socket.io";
import {
    ServerToClientEvents,
    ClientToServerEvents,
    //TypingStartPayload,
    // TypingStopPayload,
    SocketEvents,
} from "./../../types/SocketEvents.js";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;
type Socket = import("socket.io").Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

/**
 * Registers handlers on a socket to broadcast typing start/stop events to other members of a conversation.
 *
 * Emits `SocketEvents.TYPING_START` and `SocketEvents.TYPING_STOP` to the room identified by `conversationId`, excluding the originating socket. Emitted payloads include `conversationId` and the initiating `userId` from `socket.data.userId`.
 *
 * @param io - The Socket.IO server instance
 * @param socket - The connected client socket that will receive the typing event listeners
 */
export function typingHandler(io: IO, socket: Socket) {
    socket.on(SocketEvents.TYPING_START, (payload: { conversationId: string }) => {

        const { conversationId } = payload;

        socket.to(conversationId).emit(SocketEvents.TYPING_START, {
            conversationId,
            userId: socket.data.userId,
        });
    });

    socket.on(SocketEvents.TYPING_STOP, (payload: { conversationId: string }) => {
        const { conversationId } = payload;

        socket.to(conversationId).emit(SocketEvents.TYPING_STOP, {
            conversationId,
            userId: socket.data.userId,
        });
    });
}