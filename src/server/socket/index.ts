import { initRedis } from "./redis.js";
import { initIO } from "./io.js";
import { socketAuth } from "./middleware/auth.js";
import messageEditHandler from "./handlers/message/edit.handler.js";
import { DeleteHandler } from "./handlers/message/delete.handler.js";
import { adminHandler } from "./handlers/admin/admin.js";
import { presenceHandler } from "./handlers/presence/presence.handler.js";
import { registerMessageHandlers } from "./handlers/message/message.handler.js";

import { typingHandler } from "./handlers/typing/typing.handler.js";
import type { Socket } from "socket.io";
/**
 * Initialize Redis and Socket.IO, attach the IO server to the provided HTTP server, apply connection authentication, and register per-connection handlers.
 *
 * Sets up user-specific rooms on connection and installs handlers for admin, presence, messages, typing, edits, and deletions.
 *
 * @param server - The HTTP(S) server instance to attach Socket.IO to (e.g., Node `http.Server` or equivalent)
 */

export async function initSocket(server: any) {
    const redis = await initRedis();
    const io = initIO(server, redis);

    io.use(socketAuth);

    io.on("connection", (socket: Socket) => {
        const userId = socket.data.userId;
        socket.join(`user:${userId}`);
        console.log("🔌 socket connected:", socket.id);
        adminHandler(io, socket, redis);
        presenceHandler(io, socket);
        registerMessageHandlers(io, socket);
        typingHandler(io, socket);
        messageEditHandler(io, socket);
        DeleteHandler(io, socket);
    });
}