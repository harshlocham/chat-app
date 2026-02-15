// src/server/socket/handlers/call/call.handler.ts
import type { Server as IOServer } from "socket.io";
import {
    ServerToClientEvents,
    ClientToServerEvents,
    CallOfferPayload,
    CallAnswerPayload,
    CallEndPayload,
    CallRingingPayload,
    SocketEvents,
} from "./../../types/SocketEvents.js";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;
type Socket = import("socket.io").Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

/**
 * Register call-related Socket.IO listeners on the provided socket and forward signaling events to the specified target clients.
 *
 * Listens for CALL_OFFER, CALL_ANSWER, CALL_END, and CALL_BUSY events and emits the corresponding event to the `to` socket ID. Each forwarded payload includes `from` (the sender's user ID from `socket.data.user._id`), `to`, and any relevant signaling data (`offer` or `answer`) when applicable.
 */
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

    socket.on(SocketEvents.CALL_BUSY, ({ to }: CallRingingPayload) => {
        io.to(to).emit(SocketEvents.CALL_BUSY, {
            from: socket.data.user._id,
            to,
        });
    });
}