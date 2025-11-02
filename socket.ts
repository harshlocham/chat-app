import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";

interface CustomSocket extends Socket {
    userId: string;
    isAdmin: boolean;
}

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.ORIGIN || "*",
        methods: ["GET", "POST"],
        credentials: true,
    },
});

//  REDIS CONFIG
const pubClient = createClient({ url: "redis://default:z1wD6s2xExHPg42hM0DRCUlN3RMVUqq6@redis-12403.c8.us-east-1-4.ec2.redns.redis-cloud.com:12403" });
console.log(process.env.REDIS_URL);
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));

console.log("🔗 Redis adapter connected");

//  CACHING KEYS
const PRESENCE_KEY = "active_users";
const MESSAGE_COUNT_KEY = "total_messages_today";

// Reset at midnight
async function resetDailyCounterIfNeeded() {
    const now = new Date().setHours(0, 0, 0, 0);
    const lastReset = Number(await pubClient.get("last_reset") || 0);

    if (now !== lastReset) {
        await pubClient.set(MESSAGE_COUNT_KEY, 0);
        await pubClient.set("last_reset", now);
    }
}

//  SOCKET HANDLERS
io.use((socket, next) => {
    const { userId, isAdmin } = socket.handshake.auth;
    (socket as CustomSocket).userId = userId || socket.id;
    (socket as CustomSocket).isAdmin = isAdmin || false;
    next();
});

const typingTimers = new Map<string, NodeJS.Timeout>();

io.on("connection", async (rawSocket) => {
    const socket = rawSocket as CustomSocket;
    const { userId, isAdmin } = socket;
    console.log("✅ Connected:", socket.id, "user:", userId, "admin:", isAdmin);

    if (!isAdmin) {
        await pubClient.sAdd(PRESENCE_KEY, userId);
        const activeUsers = await pubClient.sCard(PRESENCE_KEY);
        io.to("admins").emit("dashboard:update", { activeUsers });
    }

    socket.on("admin:join", async () => {
        socket.join("admins");
        const [activeUsers, totalMessagesToday] = await Promise.all([
            pubClient.sCard(PRESENCE_KEY),
            pubClient.get(MESSAGE_COUNT_KEY),
        ]);
        socket.emit("dashboard:init", {
            activeUsers,
            totalMessagesToday: Number(totalMessagesToday) || 0,
        });
    });

    socket.on("join", (conversationId: string) => {
        socket.join(conversationId);
        socket.emit("joined", conversationId);
        console.log(`🟢 User ${userId} joined conversation ${conversationId}`);
    });

    socket.on("typing", (conversationId: string, username: string) => {
        socket.to(conversationId).emit("typing", { username });

        clearTimeout(typingTimers.get(username));
        const timeout = setTimeout(() => {
            socket.to(conversationId).emit("stopTyping", { username });
            typingTimers.delete(username);
        }, 3000);
        typingTimers.set(userId, timeout);
    });

    socket.on("stopTyping", (conversationId: string, username: string) => {
        clearTimeout(typingTimers.get(username));
        typingTimers.delete(username);
        socket.to(conversationId).emit("stopTyping", { username });
    });

    socket.on("message:send", async (msg, ack) => {
        await resetDailyCounterIfNeeded();
        const total = await pubClient.incr(MESSAGE_COUNT_KEY);

        io.to(msg.conversationId).emit("message:new", msg);
        io.to("admins").emit("dashboard:update", { totalMessagesToday: total });

        if (ack) ack({ status: "ok", message: "Delivered" });
    });

    socket.on("disconnect", async () => {
        if (!isAdmin) {
            await pubClient.sRem(PRESENCE_KEY, userId);
            const activeUsers = await pubClient.sCard(PRESENCE_KEY);
            io.to("admins").emit("dashboard:update", { activeUsers });
        }
        console.log("❌ Disconnected:", socket.id);
    });
});

//  START SERVER
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Socket.IO + Redis server running on http://localhost:${PORT}`);
});