// src/server/socket/handlers/call/call.handler.ts
import type { Server as IOServer } from "socket.io";
import {
    ServerToClientEvents,
    ClientToServerEvents,
    CallOfferPayload,
    CallAnswerPayload,
    CallEndPayload,
    CallBusyPayload,
    SocketEvents,
} from "@/server/socket/types/SocketEvents";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;
type Socket = import("socket.io").Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

export function callHandler(io: IO, socket: Socket) {
    socket.on(SocketEvents.CALL_OFFER, ({ to, offer }: CallOfferPayload) => {
        io.to(to).emit(SocketEvents.CALL_OFFER, {
            from: socket.data.user._id,
            to,
            offer,
        });
    });

    socket.on(SocketEvents.CALL_ANSWER, ({ to, answer }: CallAnswerPayload) => {
        io.to(to).emit(SocketEvents.CALL_ANSWER, {
            from: socket.data.user._id,
            to,
            answer,
        });
    });

    socket.on(SocketEvents.CALL_END, ({ to }: CallEndPayload) => {
        io.to(to).emit(SocketEvents.CALL_END, {
            from: socket.data.user._id,
            to,
        });
    });

    socket.on(SocketEvents.CALL_BUSY, ({ to }: CallBusyPayload) => {
        io.to(to).emit(SocketEvents.CALL_BUSY, {
            from: socket.data.user._id,
            to,
        });
    });
}