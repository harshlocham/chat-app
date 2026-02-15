import { Socket } from "socket.io";

/**
 * Initialize per-socket authentication data from the handshake payload.
 *
 * Sets `socket.data.userId` to the provided `handshake.auth.userId` or falls back to the socket's id,
 * and sets `socket.data.isAdmin` to the boolean value of `handshake.auth.isAdmin`. Invokes `next()` to continue the connection flow.
 *
 * @param socket - The Socket whose `.data` will be populated with `userId` and `isAdmin`
 * @param next - Callback to continue the middleware/connection pipeline
 */
export function socketAuth(socket: Socket, next: Function) {
    const { userId, isAdmin } = socket.handshake.auth;
    socket.data.userId = userId || socket.id;
    socket.data.isAdmin = Boolean(isAdmin);

    next();
}