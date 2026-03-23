// src/server/socket/handlers/message/edit.handler.ts
import { Server, Socket } from "socket.io";
import { SocketEvents } from "@chat/types";


export default function messageEditHandler(io: Server, socket: Socket) {
    socket.on("message:edit", async (payload) => {
        const messageId = payload?.messageId;
        const conversationId = payload?.conversationId;
        const text = payload?.text;

        if (!messageId || !conversationId || typeof text !== "string") {
            socket.emit(SocketEvents.ERROR_MESSAGE, {
                type: "validation_error",
                message: "Invalid edit payload",
            });
            return;
        }

        const room = `conversation:${conversationId}`;
        if (!socket.rooms.has(room)) {
            socket.emit(SocketEvents.ERROR_AUTH, {
                type: "forbidden",
                message: "Not joined to target conversation",
            });
            return;
        }

        io.to(room).emit(SocketEvents.MESSAGE_EDITED, payload);
    });
}