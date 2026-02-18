import type { TypedSocket } from "../types.js";
export function socketAuth(
    socket: TypedSocket,
    next: (err?: Error) => void
): void {
    const { userId, isAdmin } = socket.handshake.auth as {
        userId?: string;
        isAdmin?: boolean;
    };

    socket.data.userId = userId ?? socket.id;
    socket.data.isAdmin = Boolean(isAdmin);

    next();
}