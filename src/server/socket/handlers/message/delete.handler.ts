import { Server, Socket } from "socket.io";
import { SocketEvents } from "./../../types/SocketEvents.js";

/**
 * Register a listener that broadcasts message-delete events to a conversation room.
 *
 * Listens for SocketEvents.MESSAGE_DELETE with a payload containing `conversationId` and `messageId`; when both are present it emits MESSAGE_DELETE to all sockets in the room `conversation:<conversationId>` excluding the sender. This handler does not verify message ownership before broadcasting.
 *
 * @param io - The Socket.IO server instance
 * @param socket - The client socket to attach the listener to
 */
export function DeleteHandler(io: Server, socket: Socket) {
    socket.on(SocketEvents.MESSAGE_DELETE, (payload: { conversationId: string, messageId: string }) => {
        const { conversationId, messageId } = payload;
        if (!conversationId || !messageId) return;
        // TODO: Verify socket.data.userId owns this message before broadcasting
        socket.to(`conversation:${conversationId}`).emit(SocketEvents.MESSAGE_DELETE, { messageId });
    });
}