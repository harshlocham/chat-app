// src/server/socket/handlers/message/edit.handler.ts
import { Server, Socket } from "socket.io";
import { SocketEvents } from "../../../../shared/types/SocketEvents.js";


export default function messageEditHandler(io: Server, socket: Socket) {
    socket.on("message:edit", async (payload) => {
        const room = `conversation:${payload.conversationId}`
        io.to(room).emit(SocketEvents.MESSAGE_EDITED, payload);
    });
}