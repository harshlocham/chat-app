import type { Server as IOServer } from "socket.io";

let io: IOServer | null = null;

export function registerIO(server: IOServer) {
    io = server;
}

export function emitToSocketServer(event: string, payload: unknown) {
    if (!io) {
        throw new Error("Socket.IO server not initialized");
    }

    io.emit(event, payload);
}
export function emitToConversation(conversationId: string, event: string, payload: unknown) {
    if (!io) {
        throw new Error("Socket.IO server not initialized");
    }

    io.to(`conversation:${conversationId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
    if (!io) {
        throw new Error("Socket.IO server not initialized");
    }

    io.to(`user:${userId}`).emit(event, payload);
}