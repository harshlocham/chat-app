import { Server, Socket } from "socket.io";
import { RedisAdapterClients } from "../../redis.js";
import { SocketEvents } from "../../../../shared/types/SocketEvents.js";

const PRESENCE_KEY = "active_users";
const MESSAGE_COUNT_KEY = "total_messages_today";

export function adminHandler(io: Server, socket: Socket, redis: RedisAdapterClients) {
    socket.on(SocketEvents.ADMIN_JOIN, async () => {
        socket.join("admins");

        const [activeUsers, totalMessagesToday] = await Promise.all([
            redis.pubClient.scard(PRESENCE_KEY),
            redis.pubClient.get(MESSAGE_COUNT_KEY),
        ]);

        socket.emit(SocketEvents.DASHBOARD_INIT, {
            activeUsers,
            totalMessagesToday: Number(totalMessagesToday) || 0,
        });
    });
}