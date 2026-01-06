import { Server, Socket } from "socket.io";
import { SocketEvents } from "@/server/socket/types/SocketEvents";

export function DeleteHandler(io: Server, socket: Socket) {
    socket.on(SocketEvents.MESSAGE_DELETE, (payload) => {
        const { conversationId, messageId } = payload;
        if (!conversationId || !messageId) return;
        socket.to(conversationId).emit(SocketEvents.MESSAGE_DELETE, { messageId });
    });
}