// src/server/socket/handlers/presence/presence.handler.ts
import type { Server as IOServer } from "socket.io";
import {
    ServerToClientEvents,
    ClientToServerEvents,
    SocketEvents,
} from "./../../types/SocketEvents.js";
// import {
//     setOnline,
//     setOffline,
// } from "./../../../services/presence.service.js";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;
type Socket = import("socket.io").Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

export function presenceHandler(io: IO, socket: Socket) {
    const userId = socket.data.userId;
    if (!userId) {
        console.warn("presenceHandler: missing userId");
        return;
    };

    //setOnline(userId, socket.id);
    io.emit(SocketEvents.USER_ONLINE, { userId });

    socket.on("disconnect", () => {
        //setOffline(userId);
        io.emit(SocketEvents.USER_OFFLINE, {
            userId,
            lastSeen: new Date(),
        });
    });
}