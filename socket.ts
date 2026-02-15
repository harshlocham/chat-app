import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import dotenv from "dotenv";
//import Message from "./src/models/Message.js";
//import User from "./src/models/User";
//import { editMessage, reactToMessage } from "@/lib/api";

interface CustomSocket extends Socket {
    userId: string;
    isAdmin: boolean;
}
dotenv.config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    path: "/api/socket",
    cors: {
        origin: process.env.ORIGIN || "*",
        methods: ["GET", "POST"],
        credentials: true,
    },
});

//  REDIS CONFIG
const pubClient = createClient({ url: process.env.REDIS_URL });
//console.log(process.env.REDIS_URL)
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
pubClient.on("error", (err) => {
    console.log("❌ Redis Client Error:", err);
});

console.log("🔗 Redis adapter connected");

//  CACHING KEYS
const PRESENCE_KEY = "active_users";
const MESSAGE_COUNT_KEY = "total_messages_today";

/**
 * Reset the Redis daily message counter if a new day has started.
 *
 * Checks the stored "last_reset" midnight timestamp and, when it differs from
 * the current day's midnight, sets MESSAGE_COUNT_KEY to 0 and updates
 * "last_reset" in Redis.
 */
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

    //  ADMIN EVENTS
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

    //  CONVERSATION EVENTS
    socket.on("join", (conversationId: string) => {
        socket.join(conversationId);
        socket.emit("joined", conversationId);
        console.log(`🟢 User ${userId} joined conversation ${conversationId}`);
    });

    //  TYPING EVENTS
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
    // Message send event (increments daily message count)
    socket.on("message:send", async (msg, ack) => {
        await resetDailyCounterIfNeeded();
        const total = await pubClient.incr(MESSAGE_COUNT_KEY);

        io.to(msg.conversationId).emit("message:new", msg);
        io.to("admins").emit("dashboard:update", { totalMessagesToday: total });

        if (ack) ack({ status: "ok", message: "Delivered" });
    });

    // Message Reaction event +++
    // socket.on("message:react", async ({ messageId, emoji, userId }) => {
    //     try {
    //         const msg = await Message.findById(messageId)

    // if (!msg) return;

    //         let reaction = msg.reactions!.find((r: any) => r.emoji === emoji);

    //         // If reaction exists, toggle user
    //         if (reaction) {
    //             const index = reaction.users.findIndex(
    //                 (u: string) => u.toString() === userId
    //             );

    //             if (index !== -1) {
    //                 reaction.users.splice(index, 1); // Remove reaction
    //             } else {
    //                 reaction.users.push(userId); // Add reaction
    //             }
    //         } else {
    //             // new reaction
    //             msg.reactions!.push({
    //                 emoji,
    //                 users: [userId],
    //             });
    //         }

    // await msg.save();

    //         const populated = await msg.populate([
    //             { path: "sender", select: "username avatarUrl" },
    //             { path: "repliedTo", populate: { path: "sender" } },
    //         ]);

    //         // Broadcast to room
    //         io.to(msg.conversationId.toString()).emit(
    //             "message:reaction:updated",
    //             populated
    //         );
    //     } catch (err) {
    //         console.log("Error reacting to message:", err);
    //     }
    // });


    // Message Edit event +++
    socket.on("message:edit", async ({ messageId, content }) => {
        //   editMessage(messageId, content)
        io.to(messageId).emit("message:edited", { messageId, content })
    })
    socket.on("message:delete", async ({ messageId }) => {
        console.log("message:delete", messageId)
        io.to(messageId).emit("message:deleted", { messageId })
    })
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