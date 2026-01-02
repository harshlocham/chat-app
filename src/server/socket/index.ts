import { initRedis } from "./redis";
import http from "http";
import { initIO } from "./io";
import { socketAuth } from "./middleware/auth";
import { adminHandler } from "./handlers/admin/admin";
import { presenceHandler } from "./handlers/presence/presence.handler";
import { typingHandler } from "./handlers/typing/typing.handler";
import { registerMessageHandlers } from "./handlers/message/message.handler";

export async function initSocket(server: any) {
    const redis = await initRedis();
    const io = initIO(server, redis);

    io.use(socketAuth);

    io.on("connection", (socket) => {
        adminHandler(io, socket, redis);
        presenceHandler(io, socket, redis);
        typingHandler(io, socket);
        registerMessageHandlers(io, socket, redis);
    });
}