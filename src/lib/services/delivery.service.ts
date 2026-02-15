import mongoose from "mongoose";

/**
 * Mark a message as delivered by sending a PATCH to the server.
 *
 * @param messageId - The message's MongoDB ObjectId string; returns `null` immediately if this is not a valid ObjectId.
 * @param at - Delivery timestamp as a `Date` or numeric milliseconds since epoch.
 * @returns The parsed JSON response body from the server, or `null` when `messageId` is invalid.
 * @throws Error if the HTTP response is not successful; the error message is taken from the response `error` field when available.
 */
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
    // socket.emit("message:delivered", { messageId, userId, at });
    return await res.json();
}