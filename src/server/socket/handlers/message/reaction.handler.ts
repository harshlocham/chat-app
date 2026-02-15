// src/server/socket/handlers/message/reaction.handler.ts
import { Server, Socket } from "socket.io";

/**
 * Registers a socket listener that broadcasts message reaction updates to the conversation room.
 *
 * @param io - The Socket.IO server used to emit events to rooms
 * @param socket - The connected client socket to attach the listener to
 */
export default function reactionHandler(io: Server, socket: Socket) {
    socket.on("message:react", async (message) => {

        io.to(message.conversationId.toString()).emit("message:reaction:updated", message);
    });
}