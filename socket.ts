// socket.ts (or server.ts)
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // Next.js frontend
        methods: ["GET", "POST"],
    },
});

io.on("connection", (socket) => {
    // console.log("✅ Socket connected:", socket.id);

    socket.on("join", (conversationId: string) => {
        socket.join(conversationId);
        socket.emit("joined", conversationId); // ✅ frontend can wait for this
        console.log(`🟢 User joined conversation ${conversationId}`);
    });

    socket.on("message:send", (msg, ack) => {
        io.to(msg.conversationId).emit("message:new", msg);
        // console.log(`📨 Message sent to ${msg.conversationId}`);
        if (ack) ack({ status: "ok", message: "Delivered" });
    });

    socket.on("disconnect", () => {
        console.log("🔌 Socket disconnected:", socket.id);
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`🚀 Socket.IO server running on http://localhost:${PORT}`);
});
