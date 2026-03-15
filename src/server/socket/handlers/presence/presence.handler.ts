// src/server/socket/handlers/presence/presence.handler.ts
import type { Server as IOServer } from "socket.io";
import type { Redis } from "ioredis";
import {
    ServerToClientEvents,
    ClientToServerEvents,
    SocketEvents,
} from "../../../../shared/types/SocketEvents.js";
import {
    getActiveUsers,
    refreshPresence,
    trackSocketConnected,
    trackSocketDisconnected,
} from "../../services/presence.redis.service.js";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;
type Socket = import("socket.io").Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

export function presenceHandler(io: IO, socket: Socket, redis: Redis) {
    const userId = socket.data.userId;
    if (!userId) {
        console.warn("presenceHandler: missing userId");
        return;
    }

    void (async () => {
        try {
            const { becameOnline } = await trackSocketConnected(redis, userId, socket.id);

            const activeUsers = await getActiveUsers(redis);
            for (const activeUserId of activeUsers) {
                socket.emit(SocketEvents.USER_ONLINE, { userId: activeUserId });
            }

            if (becameOnline) {
                io.emit(SocketEvents.USER_ONLINE, { userId });
            }
        } catch (error) {
            console.error("presence connect error", error);
        }
    })();

    socket.on(SocketEvents.PRESENCE_PING, async () => {
        try {
            await refreshPresence(redis, userId);
        } catch (error) {
            console.error("presence ping error", error);
        }
    });

    socket.on("disconnect", async () => {
        try {
            const { wentOffline } = await trackSocketDisconnected(redis, userId, socket.id);
            if (wentOffline) {
                io.emit(SocketEvents.USER_OFFLINE, {
                    userId,
                    lastSeen: new Date(),
                });
            }
        } catch (error) {
            console.error("presence disconnect error", error);
        }
    });
}