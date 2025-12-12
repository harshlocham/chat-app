// src/server/socket/handlers/message.handler.ts
import { Server, Socket } from "socket.io";
import Message from "@/models/Message";
import { Conversation } from "@/models/Conversation";
import mongoose from "mongoose";
import { SocketEvents } from "@/server/socket/types/SocketEvents"; // enum described earlier

export function registerMessageHandlers(io: Server, socket: Socket) {

    // client -> server: create message
    socket.on(SocketEvents.MESSAGE_NEW, async (payload, ack) => {
        // payload: { tempId, conversationId, content, type }
        try {
            const { tempId, conversationId, content, type } = payload;
            const senderId = socket.data.userId; // set on auth middleware

            // Basic validation
            if (!conversationId || !mongoose.isValidObjectId(conversationId)) {
                return ack?.({ ok: false, error: "Invalid conversationId" });
            }
            if (!tempId) return ack?.({ ok: false, error: "Missing tempId" });
            //validate types/content business logic
            const allowedTypes = ["text", "image", "video", "audio", "voice", "file"];
            if (!allowedTypes.includes(type)) return ack?.({ ok: false, error: "Invalid message type" });
            if (typeof (content) !== "string" || content.length === 0) return ack?.({ ok: false, error: "Empty content" });
            // Example sanitization (replace with actual lib)
            const safeContent = content.trim();
            // Start a mongoose session for atomicity 
            const session = await mongoose.startSession();
            let messageDoc: any = null;
            try {
                await session.withTransaction(async () => {
                    // Ensure conversation exists and sender is participant
                    const conv = await Conversation.findById(conversationId).session(session).select("participants");
                    if (!conv) throw new Error("Conversation not found");
                    const participantIds = (conv.participants || []).map((p: any) => String(p._id));
                    if (!participantIds.includes(senderId)) throw new Error("Sender is not a participant");

                    // Create message doc
                    messageDoc = await Message.create(
                        [{
                            conversationId,
                            sender: senderId,
                            tempId,
                            content: safeContent,
                            type,
                            timestamp: new Date(),
                            deliveredTo: [],
                            seenBy: []
                        }],
                        { session }
                    ).then(docs => docs[0]);
                    // Update conversation last message and updatedAt (and unread count if needed)
                    //  NOTE: adapt unread counter update to your schema; here's a placeholder
                    // If Conversation keeps per-participant unread counts, update them here.
                    await Conversation.findByIdAndUpdate(
                        conversationId,
                        {
                            $set: { lastMessage: messageDoc._id, updatedAt: new Date() }
                        },
                        { session }

                    );
                })
            } finally {
                session.endSession();
            }
            // Acknowledge sender with canonical message (so they can replace temp)
            // Send the ack first; it contains canonical id and timestamp.
            ack?.({
                ok: true,
                message: messageDoc
            });
            // Emit to sender's room (all their sockets) so multi-device replacement works
            // we assume server joins sockets into room `user:<userId>`
            io.to(`user:${String(senderId)}`).emit(SocketEvents.MESSAGE_NEW, { message: messageDoc });

            // Emit to each participant (except sender) their incoming message
            // For large groups you may want a different strategy (rooms per conversation).
            const conv = await Conversation.findById(conversationId).select("participants");
            const participantIds = conv?.participants?.map((p: any) => String(p._id)) ?? [];
            for (const participantId of participantIds) {
                if (participantId === String(senderId)) continue;
                // deliver event — client should ACK it (see note) which will update message.deliveredTo
                io.to(`user:${participantId}`).emit(SocketEvents.MESSAGE_DELIVERED, { message: messageDoc });
            }

            // NOTE: At this point we haven't mutated message.deliveredTo. Consider:
            // - mark delivered when recipient's client emits DELIVERY_ACK (preferred)
            // - OR mark delivered when socket.io emit returns an ack from the recipient socket(s) (harder)
        } catch (err: any) {
            console.error("message.send error", err);
            // avoid leaking server internals
            ack?.({ ok: false, error: err?.message ?? "Server error" });
        }
    });

    // recipient -> server: delivered
    socket.on(SocketEvents.MESSAGE_DELIVERED, async (payload) => {
        // payload: { messageId, conversationId }
        try {
            const userId = socket.data.userId;
            const { messageId } = payload;
            if (!mongoose.isValidObjectId(messageId)) return;

            // add delivered timestamp for this user if not present
            await Message.updateOne(
                { _id: messageId, "deliveredTo.userId": { $ne: userId } },
                { $push: { deliveredTo: { userId, at: new Date() } } }
            );

            // notify participants about delivery update (or optimize: only notify the sender)
            // fetch minimal info
            io.to(`conversation:${payload.conversationId}`).emit(SocketEvents.MESSAGE_DELIVERED_UPDATE, {
                messageId,
                userId,
                deliverdAt: new Date()
            });
        } catch (err) {
            console.error("message.delivered error", err);
        }
    });

    socket.on(SocketEvents.MESSAGE_SEEN, async (payload) => {
        // payload: { messageId, conversationId }
        try {
            const userId = socket.data.userId;
            const { messageId } = payload;
            if (!mongoose.isValidObjectId(messageId)) return;

            await Message.updateOne(
                { _id: messageId, "seenBy.userId": { $ne: userId } },
                { $push: { seenBy: { userId, at: new Date() } } }
            );

            io.to(`conversation:${payload.conversationId}`).emit(SocketEvents.MESSAGE_SEEN, {
                messageId,
                userId,
                at: new Date()
            });
        } catch (err) {
            console.error("message.seen error", err);
        }
    });

    // On reconnection, server should send pending messages (handled in login/reconnect handler)
}