// src/server/socket/handlers/message/reaction.handler.ts
import { Server, Socket } from "socket.io";

export default function reactionHandler(io: Server, socket: Socket) {
    socket.on("message:react", async (message) => {

        io.to(message.conversationId.toString()).emit("message:reaction:updated", message);
    });
}