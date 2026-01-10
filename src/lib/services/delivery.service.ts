import mongoose from "mongoose";
import { getSocket } from "../socket/socketClient";

export async function markDelivered(messageId: string, at: Date | number) {
    if (!mongoose.Types.ObjectId.isValid(messageId)) return null;

    const res = await fetch(`/api/messages/${messageId}/delivered`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ at }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to mark delivered");
    }
    const socket = getSocket();
    // socket.emit("message:delivered", { messageId, userId, at });
    return await res.json();
}