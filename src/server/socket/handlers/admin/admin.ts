import { Server, Socket } from "socket.io";
import { RedisAdapterClients } from "../../redis.js";

const PRESENCE_KEY = "active_users";
const MESSAGE_COUNT_KEY = "total_messages_today";

export function adminHandler(io: Server, socket: Socket, redis: RedisAdapterClients) {
    socket.on("admin:join", async () => {
        socket.join("admins");

        const [activeUsers, totalMessagesToday] = await Promise.all([
            redis.pubClient.sCard(PRESENCE_KEY),
            redis.pubClient.get(MESSAGE_COUNT_KEY),
        ]);

        socket.emit("dashboard:init", {
            activeUsers,
            totalMessagesToday: Number(totalMessagesToday) || 0,
        });
    });
}