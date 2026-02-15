import { Server, Socket } from "socket.io";
import { SocketEvents } from "./../../types/SocketEvents.js";

/**
 * Registers a listener that adds the socket to a conversation room when a join event is received.
 *
 * The handler listens for SocketEvents.CONVERSATION_JOIN and expects a payload containing `conversationId`.
 * If `conversationId` is provided the socket joins the room named `conversation:<conversationId>`; if it is missing no action is taken.
 */
export function JoinHandler(io: Server, socket: Socket) {

    socket.on(SocketEvents.CONVERSATION_JOIN, (payload: { conversationId: string }) => {
        const { conversationId } = payload;
        if (!conversationId) return;
        socket.join(`conversation:${conversationId}`);
    });
}