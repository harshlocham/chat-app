const onlineUsers = new Map<string, string>(); /**
 * Mark a user as online by recording or updating their associated socket ID.
 *
 * @param userId - The unique identifier of the user to mark online
 * @param socketId - The socket identifier representing the user's active connection
 */

export function setOnline(userId: string, socketId: string) {
    onlineUsers.set(userId, socketId);
}

/**
 * Marks a user as offline by removing their entry from the in-memory presence map.
 *
 * @param userId - The identifier of the user to mark offline
 */
export function setOffline(userId: string) {
    onlineUsers.delete(userId);
}

/**
 * Determine if a user is currently marked as online.
 *
 * @param userId - The unique identifier of the user to check
 * @returns `true` if the user is online, `false` otherwise
 */
export function isOnline(userId: string) {
    return onlineUsers.has(userId);
}

/**
 * Get the list of user IDs currently marked online.
 *
 * @returns An array of user IDs that are currently online.
 */
export function getOnlineUsers() {
    return Array.from(onlineUsers.keys());
}