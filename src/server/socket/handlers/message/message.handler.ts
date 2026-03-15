import type { Redis } from "ioredis";
import type { Server as IOServer } from "socket.io";
import {
    type ClientToServerEvents,
    type MessageDeliveredUpdatePayload,
    type MessageSeenUpdatePayload,
    type ServerToClientEvents,
    SocketEvents,
} from "../../../../shared/types/SocketEvents.js";
import type { MessageDTO } from "../../../../shared/dto/message.dto.js";
import {
    clearActiveConversation,
    getActiveConversation,
    isUserOnline,
    setActiveConversation,
    setMessageDeliveryState,
} from "../../services/presence.redis.service.js";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;
type Socket = import("socket.io").Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

export function registerMessageHandlers(io: IO, socket: Socket, redis: Redis) {
    const conversationRoom = (id: string) => `conversation:${id}`;

    socket.on(SocketEvents.CONVERSATION_JOIN, async (payload: { conversationId: string }) => {
        const { conversationId } = payload;
        if (!conversationId) return;

        socket.join(conversationRoom(conversationId));
        await setActiveConversation(redis, socket.data.userId, conversationId);
    });

    socket.on(SocketEvents.CONVERSATION_LEAVE, async (payload: { conversationId: string }) => {
        const { conversationId } = payload;
        if (!conversationId) return;

        socket.leave(conversationRoom(conversationId));
        await clearActiveConversation(redis, socket.data.userId, conversationId);
    });

    socket.on(
        SocketEvents.MESSAGE_SEND,
        async (
            payload: { data: MessageDTO; conversationMembers: string[] },
            ack?: (res: { ok: boolean; error?: string }) => void
        ) => {
            try {
                const { data, conversationMembers } = payload;
                const { conversationId } = data;
                if (!conversationId || !data._id) {
                    ack?.({ ok: false, error: "Invalid message payload" });
                    return;
                }

                let recipients = (conversationMembers || []).filter(Boolean);

                if (!recipients.includes(socket.data.userId)) {
                    recipients.push(socket.data.userId);
                }

                recipients = Array.from(new Set(recipients));

                for (const userId of recipients) {
                    io.to(`user:${userId}`).emit(SocketEvents.MESSAGE_NEW, data);
                }

                const senderId = socket.data.userId;
                const onlineRecipients: string[] = [];
                const seenUsers: string[] = [];

                for (const userId of recipients) {
                    if (userId === senderId) continue;

                    const online = await isUserOnline(redis, userId);
                    if (!online) continue;

                    onlineRecipients.push(userId);

                    const activeConversationId = await getActiveConversation(redis, userId);
                    if (activeConversationId === conversationId) {
                        seenUsers.push(userId);
                    }
                }

                const deliveredUsers = onlineRecipients;
                const at = new Date();

                if (seenUsers.length > 0) {
                    await setMessageDeliveryState(redis, data._id, "seen");
                } else if (deliveredUsers.length > 0) {
                    await setMessageDeliveryState(redis, data._id, "delivered");
                } else {
                    await setMessageDeliveryState(redis, data._id, "sent");
                }

                for (const userId of deliveredUsers) {
                    const deliveredPayload: MessageDeliveredUpdatePayload = {
                        messageId: data._id,
                        conversationId,
                        userId,
                        deliveredAt: at,
                    };
                    io.to(`user:${senderId}`).emit(
                        SocketEvents.MESSAGE_DELIVERED_UPDATE,
                        deliveredPayload
                    );
                }

                for (const userId of seenUsers) {
                    const seenPayload: MessageSeenUpdatePayload = {
                        conversationId,
                        messageIds: [data._id],
                        userId,
                        seenAt: at,
                    };
                    io.to(`user:${senderId}`).emit(
                        SocketEvents.MESSAGE_SEEN_UPDATE,
                        seenPayload
                    );
                }

                io.to("admins").emit(SocketEvents.DASHBOARD_UPDATE, { totalMessagesToday: 1 });
                ack?.({ ok: true });
            } catch (error) {
                console.error("message:send handler error", error);
                ack?.({ ok: false, error: "Unable to deliver message" });
            }
        }
    );
}