import { getSocket } from "./socketClient";
import { SocketEvents, MessageDeletePayload, ServerToClientEvents, MessageNewPayload } from "@/server/socket/types/SocketEvents";
import useChatStore from "@/store/chat-store";
import useSocketStore from "@/store/useSocketStore";
import { IMessagePopulated } from "@/models/Message";

/**
 * Attach application event handlers to the singleton socket instance.
 *
 * Registers a one-time set of listeners for connection status, message lifecycle (new, edited, deleted),
 * typing indicators, user presence, delivery/seen placeholders, and basic call signaling. Event handlers
 * update the chat store (useChatStore) and socket state store (useSocketStore) as events arrive.
 *
 * This function is idempotent: calling it multiple times will not register duplicate listeners.
 */
export function registerSocketListeners() {
    const socket = getSocket();
    const chat = useChatStore.getState();
    //const sock = useSocketStore.getState();

    if ((socket as any).__LISTENERS_ATTACHED__) return;
    (socket as any).__LISTENERS_ATTACHED__ = true;

    // ------------------------------------------
    // CONNECTION EVENTS
    // ------------------------------------------
    socket.on("connect", () => {
        useSocketStore.setState({ connected: true });
    });

    socket.on("disconnect", () => {
        useSocketStore.setState({ connected: false });
    });

    // ------------------------------------------
    // MESSAGE FLOW
    // ------------------------------------------
    socket.on(SocketEvents.MESSAGE_NEW, (payload) => {
        chat.addMessage(String(payload.conversationId), payload as unknown as IMessagePopulated);
    });

    //   socket.on(SocketEvents.MESSAGE_SEND_ACK, ({ tempId, realId }: { tempId: string; realId: string }) => {
    //     chat.replaceTempMessage(sock.currentConversationId!, tempId, {
    //       _id: realId,
    //       ...payload.message, // fill from server
    //     });
    //   });

    // Listen for message edited event - using type assertion to handle new event
    (socket as any).on(SocketEvents.MESSAGE_EDITED, (updated: IMessagePopulated) => {
        const conversationId = String(updated.conversationId);
        chat.updateMessage(conversationId, updated);
    });

    socket.on(SocketEvents.MESSAGE_DELETE, (payload: MessageDeletePayload) => {
        chat.removeMessage(payload.conversationId, payload.messageId);
    });

    socket.on(SocketEvents.MESSAGE_REACTION, () => {
        // chat.updateMessageReactions(updated.conversationId, updated);
    });

    // ------------------------------------------
    // DELIVERY + SEEN
    // ------------------------------------------
    socket.on(SocketEvents.MESSAGE_DELIVERED_UPDATE, ({ messageId, userId }: { messageId: string; userId: string }) => {
        // you can update delivery status inside message object
    });

    socket.on(SocketEvents.MESSAGE_SEEN_UPDATE, ({ messageId, userId }: { messageId: string; userId: string }) => {
        // update seen status (optional)
    });

    // ------------------------------------------
    // TYPING
    // ------------------------------------------
    socket.on(SocketEvents.TYPING_START, ({ conversationId, userId }: { conversationId: string; userId: string }) => {
        chat.setTyping(conversationId, userId, true);
    });

    socket.on(SocketEvents.TYPING_STOP, ({ conversationId, userId }: { conversationId: string; userId: string }) => {
        chat.setTyping(conversationId, userId, false);
    });

    // ------------------------------------------
    // PRESENCE
    // ------------------------------------------
    socket.on(SocketEvents.USER_ONLINE, ({ userId }: { userId: string }) => {
        useSocketStore.setState((s) => ({
            onlineUsers: [...new Set([...s.onlineUsers, userId])],
        }));
    });

    socket.on(SocketEvents.USER_OFFLINE, ({ userId }: { userId: string }) => {
        useSocketStore.setState((s) => ({
            onlineUsers: s.onlineUsers.filter((u) => u !== userId),
        }));
    });

    // ------------------------------------------
    // CALL EVENTS
    // ------------------------------------------
    socket.on(SocketEvents.CALL_OFFER, (data) => {
        // open modal, play ring sound, show caller
    });

    socket.on(SocketEvents.CALL_ANSWER, (data) => {
        // continue WebRTC flow
    });

    socket.on(SocketEvents.CALL_BUSY, () => { });
    socket.on(SocketEvents.CALL_END, () => { });
    socket.on(SocketEvents.CALL_ICE_CANDIDATE, (data) => { });
}