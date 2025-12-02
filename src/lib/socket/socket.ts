import { Server as IOServer } from "socket.io";

export let io: IOServer | null = null;

export function setUpSocketIO(server: IOServer) {
    io = server;
}
