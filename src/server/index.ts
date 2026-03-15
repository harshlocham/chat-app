import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import { initSocket } from "./socket/index.js";
import { emitToConversation, emitToUser } from "./socket/emit.js";
import { SocketEvents } from "../shared/types/SocketEvents.js";
import {
    getInternalSecret,
    hasValidInternalSecret,
    INTERNAL_SECRET_HEADER,
} from "../shared/utils/internal-bridge-auth.js";


const app = express();
app.use(cors({
    origin: process.env.ORIGIN,
}));
app.use(express.json());

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
    console.log("🔌 internal/message-deleted", req.body);
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