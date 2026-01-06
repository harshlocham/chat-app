import { Server, Socket } from "socket.io";
import { SocketEvents } from "@/server/socket/types/SocketEvents";

export function JoinHandler(io: Server, socket: Socket) {

    socket.on(SocketEvents.CONVERSATION_JOIN, (payload) => {
        const { conversationId } = payload;
        if (!conversationId) return;
        socket.join(`conversation:${conversationId}`);
    });
}