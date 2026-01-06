// src/server/socket/handlers/message/edit.handler.ts
import { Server, Socket } from "socket.io";
import { SocketEvents } from "@/server/socket/types/SocketEvents";


export default function messageEditHandler(io: Server, socket: Socket) {
    socket.on("message:edit", async (payload) => {

        io.to(payload.conversationId.toString()).emit(SocketEvents.MESSAGE_EDITED, payload);
    });
}