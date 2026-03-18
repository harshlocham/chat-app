import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import http from "http";
import cors from "cors";
import { initSocket } from "./server/socket/index.js";
import { emitToConversation, emitToUser } from "./server/socket/emit.js";
import { SocketEvents } from "@chat/types";
import {
    getInternalSecret,
    hasValidInternalSecret,
    INTERNAL_SECRET_HEADER,
} from "@chat/types/utils/internal-bridge-auth";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const visitedEnvPaths = new Set<string>();
let scanDir = currentDir;

for (let depth = 0; depth < 8; depth++) {
    const envPath = path.join(scanDir, ".env");

    if (!visitedEnvPaths.has(envPath) && existsSync(envPath)) {
        loadEnv({ path: envPath });
        visitedEnvPaths.add(envPath);
    }

    const parent = path.dirname(scanDir);
    if (parent === scanDir) {
        break;
    }
    scanDir = parent;
}


const app = express();
app.use(cors({
    origin: process.env.ORIGIN,
}));
app.use(express.json());

app.get("/health", (_req, res) => {
    return res.status(200).json({
        status: "ok",
        service: "socket",
        uptime: Math.floor(process.uptime()),
    });
});

const internalSecret = getInternalSecret();

app.use("/internal", (req, res, next) => {
    const providedSecret = req.header(INTERNAL_SECRET_HEADER);

    if (!hasValidInternalSecret(providedSecret, internalSecret)) {
        return res.status(401).json({ error: "Unauthorized internal request" });
    }

    next();
});

const server = http.createServer(app);

await initSocket(server);


app.post("/internal/message-deleted", (req, res) => {
    const { conversationId, payload } = req.body;

    if (!conversationId || !payload) {
        return res.status(400).json({ error: "Invalid payload" });
    }

    emitToConversation(conversationId, SocketEvents.MESSAGE_DELETE, payload);

    return res.json({ success: true });
})
app.post("/internal/message-reaction", (req, res) => {
    const { conversationId, payload } = req.body;

    if (!conversationId || !payload) {
        return res.status(400).json({ error: "Invalid payload" });
    }

    emitToConversation(conversationId, SocketEvents.MESSAGE_REACTION, payload);

    return res.json({ success: true });
});

app.post("/internal/message-delivered", (req, res) => {
    const { messageId, conversationId, userId, deliveredAt, senderId } = req.body || {};

    if (!messageId || !conversationId || !userId || !senderId) {
        return res.status(400).json({ error: "Invalid payload" });
    }

    emitToUser(senderId, SocketEvents.MESSAGE_DELIVERED_UPDATE, {
        messageId,
        conversationId,
        userId,
        deliveredAt: deliveredAt || new Date().toISOString(),
    });

    return res.json({ success: true });
});

app.post("/internal/message-seen", (req, res) => {
    const { conversationId, messageIds, userId, seenAt } = req.body || {};

    if (!conversationId || !Array.isArray(messageIds) || messageIds.length === 0 || !userId) {
        return res.status(400).json({ error: "Invalid payload" });
    }

    emitToConversation(conversationId, SocketEvents.MESSAGE_SEEN_UPDATE, {
        conversationId,
        messageIds,
        userId,
        seenAt: seenAt || new Date().toISOString(),
    });

    return res.json({ success: true });
});

server.listen(3001, () => {
    console.log("🚀 Server running on http://localhost:3001");
});