import { initRedis } from "./redis";
import { initIO } from "./io";
import { socketAuth } from "./middleware/auth";
import messageEditHandler from "./handlers/message/edit.handler";
import { DeleteHandler } from "./handlers/message/delete.handler";
import { adminHandler } from "./handlers/admin/admin";
import { presenceHandler } from "./handlers/presence/presence.handler";
import { registerMessageHandlers } from "./handlers/message/message.handler";

import { typingHandler } from "./handlers/typing/typing.handler";
//import { Server as SocketIOServer } from "socket.io";

export async function initSocket(server: any) {
    const redis = await initRedis();
    const io = initIO(server, redis);

    io.use(socketAuth);

    io.on("connection", (socket) => {
        console.log("🔌 socket connected:", socket.id);
        adminHandler(io, socket, redis);
        presenceHandler(io, socket);
        registerMessageHandlers(io, socket);
        typingHandler(io, socket);
        registerMessageHandlers(io, socket);
        messageEditHandler(io, socket);
        DeleteHandler(io, socket);
    });
}