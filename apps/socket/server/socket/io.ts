import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import type { RedisAdapterClients } from "./redis.js";

function parseAllowedOrigins(raw: string | undefined): string[] {
    if (!raw) return [];
    return raw
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

export function initIO(
    httpServer: HTTPServer,
    redis: RedisAdapterClients
) {
    const allowedOrigins = parseAllowedOrigins(process.env.ORIGIN);

    const io = new SocketIOServer(httpServer, {
        path: "/api/socket",
        cors: {
            origin: (origin, callback) => {
                if (!origin) {
                    return callback(null, true);
                }

                if (allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }

                return callback(new Error("Origin not allowed"));
            },
            methods: ["GET", "POST"],
            credentials: true,
        },
        allowRequest: (req, callback) => {
            const originHeader = req.headers.origin;
            if (!originHeader) {
                return callback(null, true);
            }

            return callback(null, allowedOrigins.includes(originHeader));
        },
        maxHttpBufferSize: 1e6,
        connectTimeout: 10_000,
    });

    if (!redis.isMock) {
        io.adapter(createAdapter(redis.pubClient, redis.subClient));
    } else {
        console.warn("⚠️ Running socket server without Redis adapter (development mock mode).");
    }

    return io;
}