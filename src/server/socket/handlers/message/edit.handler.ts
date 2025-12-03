// src/server/socket/handlers/message/edit.handler.ts
import { editMessage } from "@/lib/utils/api";
import { Socket, Server } from "socket.io";

export default function messageEditHandler(io: Server, socket: Socket) {
    socket.on("message:edit", async (payload) => {
        const updated = await editMessage(payload, socket.id);
        if (!updated) return;

        io.to(updated.conversationId.toString()).emit("message:edited", updated);
    });
}