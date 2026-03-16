import { Server, Socket } from "socket.io";
import { SocketEvents } from "@chat/types";

export function DeleteHandler(io: Server, socket: Socket) {
    socket.on(SocketEvents.MESSAGE_DELETE, (payload: { conversationId: string, messageId: string }) => {
        const { conversationId, messageId } = payload;
        if (!conversationId || !messageId) return;
        // TODO: Verify socket.data.userId owns this message before broadcasting
        io.to(`conversation:${conversationId}`).emit(SocketEvents.MESSAGE_DELETE, { messageId });
    });
}