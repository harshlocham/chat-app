// src/server/socket/handlers/presence/presence.handler.ts
import type { Server as IOServer } from "socket.io";
import {
    ServerToClientEvents,
    ClientToServerEvents,
    SocketEvents,
} from "@/server/socket/types/SocketEvents";
import {
    setOnline,
    setOffline,
} from "@/lib/services/presence.service";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;
type Socket = import("socket.io").Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

export function presenceHandler(io: IO, socket: Socket, redis: any) {
    const userId = socket.data.userId;
    if (!userId) {
        console.warn("presenceHandler: missing userId");
        return;
    };

    setOnline(userId, socket.id);
    io.emit(SocketEvents.USER_ONLINE, { userId });

    socket.on("disconnect", () => {
        setOffline(userId);
        io.emit(SocketEvents.USER_OFFLINE, {
            userId,
            lastSeen: new Date(),
        });
    });
}