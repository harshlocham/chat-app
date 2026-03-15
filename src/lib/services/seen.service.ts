export async function markSeen(conversationId: string, messageIds: string[]) {
	if (!conversationId || !Array.isArray(messageIds) || messageIds.length === 0) {
		return null;
	}

	const firstId = messageIds[0];
	const res = await fetch(`/api/messages/${firstId}/seen`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ conversationId, messageIds }),
	});

	if (!res.ok) {
		const err = await res.json();
		throw new Error(err.error || "Failed to mark seen");
	}

	return await res.json();
}
