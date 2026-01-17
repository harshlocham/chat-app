import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import type { RedisAdapterClients } from "./redis.js";

export function initIO(
    httpServer: HTTPServer,
    redis: RedisAdapterClients
) {
    const io = new SocketIOServer(httpServer, {
        path: "/api/socket",
        cors: {
            origin: process.env.ORIGIN,
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    io.adapter(createAdapter(redis.pubClient, redis.subClient));

    return io;
}