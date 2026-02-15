// src/server/socket/handlers/message/edit.handler.ts
import { Server, Socket } from "socket.io";
import { SocketEvents } from "./../../types/SocketEvents.js";


/**
 * Registers a socket listener that rebroadcasts edited message payloads to the conversation room.
 *
 * When a "message:edit" event is received on the provided socket, emits `SocketEvents.MESSAGE_EDITED`
 * to the room `conversation:{conversationId}` with the original payload.
 */
export default function messageEditHandler(io: Server, socket: Socket) {
    socket.on("message:edit", async (payload) => {
        const room = `conversation:${payload.conversationId}`
        io.to(room).emit(SocketEvents.MESSAGE_EDITED, payload);
    });
}