import { Server, Socket } from "socket.io";
import { RedisAdapterClients } from "../../redis.js";

const PRESENCE_KEY = "active_users";
const MESSAGE_COUNT_KEY = "total_messages_today";

/**
 * Register admin socket handlers to initialize the admin dashboard.
 *
 * When the socket receives the "admin:join" event, the socket is added to the
 * "admins" room, the active user count and today's total message count are
 * read from Redis, and a "dashboard:init" event is emitted with the payload:
 * `{ activeUsers, totalMessagesToday }`. `totalMessagesToday` is coerced to a
 * number and falls back to 0 if missing or unparsable.
 */
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