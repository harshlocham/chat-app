// src/server/socket/handlers/delivery/seen.handler.ts
import { Socket, Server } from "socket.io";
import { SocketEvents } from "../../../../shared/types/SocketEvents.js";

export const SeenHandler = (_io: Server, socket: Socket) => {
    socket.on(SocketEvents.MESSAGE_SEEN, (payload: { conversationId: string, messageId: string }) => {
        const { conversationId, messageId } = payload;
        if (!conversationId || !messageId) return;
        socket.to(`conversation:${conversationId}`).emit(SocketEvents.MESSAGE_SEEN_UPDATE, { messageId });
    });
}
