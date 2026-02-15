import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import type { RedisAdapterClients } from "./redis.js";

/**
 * Create a Socket.IO server bound to the given HTTP server, configured with a custom path, CORS, and a Redis adapter.
 *
 * @param httpServer - The HTTP server to attach the Socket.IO instance to
 * @param redis - Redis adapter clients containing `pubClient` and `subClient` used for inter-process messaging
 * @returns The configured Socket.IO server instance
 */
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