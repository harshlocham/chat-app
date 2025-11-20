// src/lib/services/presence.service.ts
const onlineUsers = new Map(); // userId → socketIds[]

export function userConnected(userId: string, socketId: string) {
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, []);
    onlineUsers.get(userId).push(socketId);
}

export function userDisconnected(userId: string, socketId: string) {
    if (!onlineUsers.has(userId)) return;

    const sockets = onlineUsers.get(userId).filter((id: string) => id !== socketId);
    if (sockets.length === 0) onlineUsers.delete(userId);
    else onlineUsers.set(userId, sockets);
}

export function isUserOnline(userId: string) {
    return onlineUsers.has(userId);
}

export function getOnlineUsers() {
    return [...onlineUsers.keys()];
}