import { Server, Socket } from "socket.io";
import { SocketEvents } from "../../../../shared/types/SocketEvents.js";
import { MessageDTO } from "../../../../shared/dto/message.dto.js";

export function registerMessageHandlers(io: Server, socket: Socket) {
    const conversationRoom = (id: string) => `conversation:${id}`;
    /**
     * Join conversation room
     * Called after user opens a conversation
     */
    socket.on(SocketEvents.CONVERSATION_JOIN, (payload: { conversationId: string }) => {
        const { conversationId } = payload;
        if (!conversationId) return;

        socket.join(conversationRoom(conversationId));
    });

    /**
     * Leave conversation room
     */
    socket.on(SocketEvents.CONVERSATION_LEAVE, (payload: { conversationId: string }) => {
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
    socket.on(SocketEvents.MESSAGE_SEND, (payload: { data: MessageDTO, conversationMembers: string[] }, ack: (res: { ok: boolean; error?: string }) => void) => {
        const { data, conversationMembers } = payload;
        const { conversationId } = data;
        if (!conversationId) {
            return ack?.({ ok: false, error: "Invalid message payload" });
        }
        const normalizedMessage = data;
        conversationMembers.forEach((userId: string) => {
            io.to(`user:${userId}`).emit(SocketEvents.MESSAGE_NEW, {
                ...data,
                message: normalizedMessage,
            });
        });
        io.to("admins").emit("dashboard:update", { totalMessagesToday: 1 });
        ack?.({ ok: true });
    });


    socket.on(SocketEvents.MESSAGE_DELIVERED_UPDATE, (payload: { conversationId: string }) => {
        if (!payload?.conversationId) return;

        io
            .to(conversationRoom(payload.conversationId))
            .emit(SocketEvents.MESSAGE_DELIVERED_UPDATE, payload);
    });


    // MESSAGE_SEEN_UPDATE
    /// EMITTED BY API after DB update

    socket.on(SocketEvents.MESSAGE_SEEN_UPDATE, (payload: { conversationId: string }) => {
        if (!payload?.conversationId) return;

        io
            .to(conversationRoom(payload.conversationId))
            .emit(SocketEvents.MESSAGE_SEEN_UPDATE, payload);
    });
}