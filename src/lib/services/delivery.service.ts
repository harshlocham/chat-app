export async function markDelivered(
    messageId: string,
    params?: { conversationId?: string; at?: Date | number }
) {
    const at = params?.at ?? Date.now();

    const res = await fetch(`/api/messages/${messageId}/delivered`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            at,
            conversationId: params?.conversationId,
        }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to mark delivered");
    }
    return await res.json();
}