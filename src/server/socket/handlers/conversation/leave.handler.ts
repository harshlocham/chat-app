import { Server, Socket } from "socket.io";
import { SocketEvents } from "./../../types/SocketEvents.js";

/**
 * Registers a listener that removes the socket from a conversation room when a CONVERSATION_LEAVE event is received.
 *
 * The handler expects a payload with `conversationId`; if provided, the socket will leave the room named `conversation:<conversationId>`.
 *
 * @param io - The Socket.IO server instance (unused by the handler but available for symmetry with other handlers)
 * @param socket - The socket to attach the CONVERSATION_LEAVE listener to
 */
export function LeaveHandler(io: Server, socket: Socket) {
    socket.on(SocketEvents
        .CONVERSATION_LEAVE, (payload: { conversationId: string }) => {
            const { conversationId } = payload;
            if (!conversationId) return;
            socket.leave(`conversation:${conversationId}`);
        }
    )
}