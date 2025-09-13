import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.ORIGIN,
        methods: ["GET", "POST"],
        credentials: true,
    },
});
// ACTIVE USERS MAP
const userConnections = new Map();
function addUser(userId) {
    const count = userConnections.get(userId) || 0;
    userConnections.set(userId, count + 1);
}
function removeUser(userId) {
    const count = userConnections.get(userId);
    if (!count)
        return;
    if (count === 1) {
        userConnections.delete(userId);
    }
    else {
        userConnections.set(userId, count - 1);
    }
}
function getActiveUserCount() {
    return userConnections.size;
}
// MESSAGES COUNTER
let totalMessagesToday = 0;
let today = new Date().setHours(0, 0, 0, 0);
function resetDailyCounterIfNeeded() {
    const now = new Date().setHours(0, 0, 0, 0);
    if (now !== today) {
        today = now;
        totalMessagesToday = 0;
    }
}
// SOCKET MIDDLEWARE
io.use((socket, next) => {
    const { userId, isAdmin } = socket.handshake.auth;
    socket.userId = userId || socket.id;
    socket.isAdmin = isAdmin || false;
    next();
});
// TYPING INDICATOR TIMERS
const typingTimers = new Map();
// SOCKET HANDLERS
io.on("connection", (rawSocket) => {
    const socket = rawSocket;
    const { userId, isAdmin } = socket;
    console.log("✅ Socket connected:", socket.id, "userId:", userId, "isAdmin:", isAdmin);
    // Only count non-admins as active users
    if (!isAdmin) {
        addUser(userId);
        io.to("admins").emit("dashboard:update", {
            activeUsers: getActiveUserCount(),
        });
    }
    // Admin joins dashboard
    socket.on("admin:join", () => {
        console.log("👑 Admin joined dashboard:", socket.id);
        socket.join("admins");
        socket.emit("dashboard:init", {
            activeUsers: getActiveUserCount(),
            totalMessagesToday,
        });
    });
    // User joins a conversation room
    socket.on("join", (conversationId) => {
        socket.join(conversationId);
        socket.emit("joined", conversationId);
        console.log(`🟢 User ${userId} joined conversation ${conversationId}`);
    });
    // Typing indicator with fallback
    socket.on("typing", (conversationId) => {
        socket.to(conversationId).emit("typing", { userId });
        clearTimeout(typingTimers.get(userId));
        const timeout = setTimeout(() => {
            socket.to(conversationId).emit("stopTyping", { userId });
            typingTimers.delete(userId);
        }, 3000); // fallback after 3 seconds
        typingTimers.set(userId, timeout);
    });
    socket.on("stopTyping", (conversationId) => {
        clearTimeout(typingTimers.get(userId));
        typingTimers.delete(userId);
        socket.to(conversationId).emit("stopTyping", { userId });
    });
    // New message sent
    socket.on("message:send", (msg, ack) => {
        resetDailyCounterIfNeeded();
        totalMessagesToday++;
        io.to(msg.conversationId).emit("message:new", msg);
        // Notify admins
        io.to("admins").emit("dashboard:update", {
            totalMessagesToday,
        });
        if (ack)
            ack({ status: "ok", message: "Delivered" });
    });
    // Disconnect
    socket.on("disconnect", () => {
        if (!isAdmin) {
            removeUser(userId);
            io.to("admins").emit("dashboard:update", {
                activeUsers: getActiveUserCount(),
            });
        }
        console.log("❌ Socket disconnected:", socket.id);
    });
});
// START SERVER
const PORT = 3001;
server.listen(PORT, () => {
    console.log(`🚀 Socket.IO server running on http://localhost:${PORT}`);
});
