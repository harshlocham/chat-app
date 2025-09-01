// src/pages/api/socket.ts
import { Server } from "socket.io";

let io: Server;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function handler(req: any, res: any) {
    if (!res.socket.server.io) {
        console.log("🔌 Initializing Socket.IO server...");

        io = new Server(res.socket.server, {
            path: "/api/socket_io",
        });

        io.on("connection", (socket) => {
            console.log("🟢 User connected:", socket.id);

            socket.on("send-message", (msg) => {
                socket.broadcast.emit("receive-message", msg);
            });

            socket.on("disconnect", () => {
                console.log("🔴 User disconnected:", socket.id);
            });
        });

        res.socket.server.io = io;
    }

    res.end();
}
