import { Server, Socket } from "socket.io";
import { SocketEvents } from "@/server/socket/types/SocketEvents";

export function registerMessageHandlers(io: Server, socket: Socket) {
    const conversationRoom = (id: string) => `conversation:${id}`;
    /**
     * Join conversation room
     * Called after user opens a conversation
     */
    socket.on(SocketEvents.CONVERSATION_JOIN, (payload) => {
        const { conversationId } = payload;
        if (!conversationId) return;

        socket.join(conversationRoom(conversationId));
    });

    /**
     * Leave conversation room
     */
    socket.on(SocketEvents.CONVERSATION_LEAVE, (payload) => {
        const { conversationId } = payload;
        if (!conversationId) return;

        socket.leave(conversationRoom(conversationId));
    });

    /**
     * MESSAGE_NEW
     * 🔔 EMITTED ONLY BY API (server → client)
     *
     * Payload already contains canonical DB message
     * Socket server just delivers it
     */
    socket.on(SocketEvents.MESSAGE_SEND, (message, ack) => {
        if (!message?.conversationId) {
            return ack?.({ ok: false, error: "Invalid message payload" });
        }
        io.to(message.conversationId).emit(SocketEvents.MESSAGE_NEW, message);
        console.log("🔌 message:new", message);
        io.to("admins").emit("dashboard:update", { totalMessagesToday: 1 });
        if (ack) ack({ status: "ok", message: "Delivered" });
    });

    /**
     * MESSAGE_DELIVERED_UPDATE
     * 🔔 EMITTED BY API after DB update
     */
    socket.on(SocketEvents.MESSAGE_DELIVERED_UPDATE, (payload) => {
        if (!payload?.conversationId) return;

        io
            .to(conversationRoom(payload.conversationId))
            .emit(SocketEvents.MESSAGE_DELIVERED_UPDATE, payload);
    });

    /**
     * MESSAGE_SEEN_UPDATE
     * 🔔 EMITTED BY API after DB update
     */
    socket.on(SocketEvents.MESSAGE_SEEN_UPDATE, (payload) => {
        // transport-only
        // no need to emit to clients
        if (!payload?.conversationId) return;

        io
            .to(conversationRoom(payload.conversationId))
            .emit(SocketEvents.MESSAGE_SEEN_UPDATE, payload);
    });
}