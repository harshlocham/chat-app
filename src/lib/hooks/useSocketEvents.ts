"use client";

// import { useEffect, useRef } from "react";
// import { socket } from "@/lib/socketClient";
// import  usechatStore from "@/store/chat-store";
// import { IMessagePopulated } from "@/models/Message";

// export function useSocketEvents(currentUserId?: string) {
//     const {
//         addMessage,
//         updateEditedMessage,
//         setMessages,
//         replaceTempMessage,
//         conversations,
//         updateLastMessage,
//         incrementUnread,
//         clearUnread,
//         setOnlineUsers,
//     } = usechatStore();

//     const mounted = useRef(false);

//     useEffect(() => {
//         if (mounted.current) return;
//         mounted.current = true;

//         if (!socket.connected) socket.connect();

//         // ---------------------------
//         // 1. NEW MESSAGE
//         // ---------------------------
//         socket.on("message:new", (msg: IMessagePopulated) => {
//             addMessage(msg);

//             // update last message in conversation list
//             updateLastMessage(msg.conversationId.toString(), msg);
//         });

//         // ---------------------------
//         // 2. MESSAGE EDITED
//         // ---------------------------
//         socket.on("message:edited", (msg: IMessagePopulated) => {
//             updateEditedMessage(msg);
//             updateLastMessage(msg.conversationId.toString(), msg);
//         });

//         // ---------------------------
//         // 3. MESSAGE DELETED
//         // ---------------------------
//         socket.on("message:deleted", ({ messageId, conversationId }) => {
//             setMessages(
//                 (useConversationStore
//                     .getState()
//                     .messages.filter((m) => m._id.toString() !== messageId) as IMessagePopulated[])
//             );
//         });

//         // ---------------------------
//         // 4. MESSAGE REACTION UPDATED
//         // ---------------------------
//         socket.on("message:reaction:updated", (updatedMsg) => {
//             updateEditedMessage(updatedMsg);
//         });

//         // ---------------------------
//         // 5. CONFIRM TEMP MESSAGE (server acknowledges)
//         //    this replaces temp_123 with real message
//         // ---------------------------
//         socket.on("message:sent:confirm", (realMsg) => {
//             replaceTempMessage(realMsg.tempId, realMsg);
//             updateLastMessage(realMsg.conversationId.toString(), realMsg);
//             clearUnread(realMsg.conversationId.toString());
//         });

//         // ---------------------------
//         // 6. TYPING INDICATORS
//         // ---------------------------
//         socket.on("typing:start", ({ conversationId, userId }) => {
//             if (userId === currentUserId) return;
//             const store = useConversationStore.getState();

//             const typingKey = `typing_${conversationId}`;
//             const existing = ((store as any)[typingKey] ?? new Set<string>()) as Set<string>;

//             existing.add(userId);

//             useConversationStore.setState({ [typingKey as any]: new Set(existing) });
//         });

//         socket.on("typing:stop", ({ conversationId, userId }) => {
//             const store = useConversationStore.getState();
//             const typingKey = `typing_${conversationId}`;

//             const existing = ((store as any)[typingKey] ?? new Set<string>()) as Set<string>;
//             existing.delete(userId);

//             useConversationStore.setState({ [typingKey as any]: new Set(existing) });
//         });

//         // ---------------------------
//         // 7. PRESENCE UPDATES
//         // ---------------------------
//         socket.on("user:online", (userId: string) => {
//             const online = new Set(useConversationStore.getState().onlineUsers);
//             online.add(userId);
//             setOnlineUsers(Array.from(online));
//         });

//         socket.on("user:offline", (userId: string) => {
//             const online = new Set(useConversationStore.getState().onlineUsers);
//             online.delete(userId);
//             setOnlineUsers(Array.from(online));
//         });

//         return () => {
//             socket.off("message:new");
//             socket.off("message:edited");
//             socket.off("message:deleted");
//             socket.off("message:reaction:updated");
//             socket.off("message:sent:confirm");
//             socket.off("typing:start");
//             socket.off("typing:stop");
//             socket.off("user:online");
//             socket.off("user:offline");
//         };
//     }, []);
// }