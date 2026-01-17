// src/server/socket/handlers/delivery/delivered.handler.ts
import type { Server as IOServer } from "socket.io";
import {
    type ServerToClientEvents,
    type ClientToServerEvents,
    SocketEvents,
} from "./../../types/SocketEvents.js";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;
type Socket = import("socket.io").Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

export function deliveredHandler(io: IO, socket: Socket) {
    socket.on(SocketEvents.MESSAGE_DELIVERED, async ({ messageId, userId, at }: { messageId: string, userId: string, at: Date }) => {
        if (!messageId || !userId || !at) return;
        // TODO: Verify socket.data.userId owns this message before broadcasting

        io.to(`user:${userId}`).emit(
            SocketEvents.MESSAGE_DELIVERED_UPDATE,
            { messageId, userId, deliveredAt: at }
        );
    });
}