// src/server/socket/handlers/presence/presence.handler.ts
import type { Redis } from "ioredis";
import type { Server as IOServer } from "socket.io";

import { User } from "../../../../../../packages/db/models/User.js";
import {
    ClientToServerEvents,
    ServerToClientEvents,
    SocketEvents,
} from "@chat/types";
import {
    getActiveUsers,
    refreshPresence,
    trackSocketConnected,
    trackSocketDisconnected,
} from "../../services/presence.redis.service.js";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;
type Socket = import("socket.io").Socket<ClientToServerEvents, ServerToClientEvents>;

export function presenceHandler(io: IO, socket: Socket, redis: Redis) {
    const userId = socket.data.userId;

    if (!userId) {
        console.warn("presenceHandler: missing userId");
        return;
    }

    void (async () => {
        try {
            const { becameOnline } = await trackSocketConnected(redis, userId, socket.id);

            if (becameOnline) {
                await User.updateOne(
                    { _id: userId },
                    {
                        $set: {
                            isOnline: true,
                        },
                    }
                );
            }

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
                const lastSeen = new Date();

                await User.updateOne(
                    { _id: userId },
                    {
                        $set: {
                            isOnline: false,
                            lastSeen,
                        },
                    }
                );

                io.emit(SocketEvents.USER_OFFLINE, {
                    userId,
                    lastSeen,
                });
            }
        } catch (error) {
            console.error("presence disconnect error", error);
        }
    });
}