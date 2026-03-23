import { Server, Socket } from "socket.io";
import { SocketEvents } from "@chat/types";

export function DeleteHandler(io: Server, socket: Socket) {
    socket.on(SocketEvents.MESSAGE_DELETE, (payload: { conversationId: string, messageId: string }) => {
        const conversationId = payload?.conversationId;
        const messageId = payload?.messageId;

        if (!conversationId || !messageId) {
            socket.emit(SocketEvents.ERROR_MESSAGE, {
                type: "validation_error",
                message: "Invalid delete payload",
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

        io.to(`conversation:${conversationId}`).emit(SocketEvents.MESSAGE_DELETE, { messageId });
    });
}