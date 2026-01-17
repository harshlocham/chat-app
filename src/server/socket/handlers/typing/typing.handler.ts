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