// src/server/socket/handlers/call/call.handler.ts
import type { Server as IOServer } from "socket.io";
import type { Redis } from "ioredis";
import {
    CallAcceptPayload,
    ServerToClientEvents,
    ClientToServerEvents,
    CallOfferPayload,
    CallOfferInitPayload,
    CallAnswerPayload,
    CallIceCandidatePayload,
    CallEndPayload,
    CallRejectPayload,
    CallStatePayload,
    CallRingingPayload,
    SocketErrorPayload,
    SocketEvents,
} from "@chat/types";
import {
    acceptCall,
    buildCallStatePayload,
    clearReconnectGraceTimeout,
    clearCallTimeout,
    endCall,
    expireReconnectGrace,
    refreshCallHeartbeat,
    initiateCall,
    markCallActive,
    markCallReconnecting,
    rejectCall,
    resumeCallFromReconnect,
    scheduleReconnectGraceTimeout,
    scheduleCallTimeout,
    timeoutCall,
} from "../../services/call.orchestration.service.js";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;
type Socket = import("socket.io").Socket<
    ClientToServerEvents,
    ServerToClientEvents
>;

function emitCallError(socket: Socket, message: string, data?: unknown) {
    const payload: SocketErrorPayload = {
        type: "call_error",
        message,
        data,
    };
    socket.emit(SocketEvents.ERROR_CALL, payload);
}

export function callHandler(io: IO, socket: Socket, redis: Redis) {
    const userRoom = (userId: string) => `user:${userId}`;

    socket.on(
        SocketEvents.CALL_OFFER_INIT,
        async ({ callId, conversationId, to, callType }: CallOfferInitPayload) => {
            const from = socket.data.userId;
            if (!to) return;

            const result = await initiateCall(
                redis,
                {
                    callId,
                    conversationId,
                    from,
                    to,
                    callType,
                },
                from
            );

            if (!result.ok) {
                if (result.reason === "busy") {
                    io.to(userRoom(from)).emit(SocketEvents.CALL_BUSY, {
                        callId,
                        conversationId,
                        from: to,
                        to: from,
                    });
                }
                emitCallError(socket, result.message, { callId, to });
                return;
            }

            const statePayload = buildCallStatePayload(result.state);
            const expiresAt = new Date(Date.now() + 45 * 1000);

            io.to(userRoom(to)).emit(SocketEvents.CALL_RINGING, {
                callId,
                conversationId,
                from,
                to,
                expiresAt,
            });

            io.to(userRoom(from)).emit(SocketEvents.CALL_STATE, statePayload);
            io.to(userRoom(to)).emit(SocketEvents.CALL_STATE, statePayload);

            io.to(userRoom(to)).emit(SocketEvents.CALL_OFFER_INIT, {
                callId,
                conversationId,
                from,
                to,
                callType,
            });

            scheduleCallTimeout(callId, async () => {
                const timeoutResult = await timeoutCall(redis, callId);
                if (!timeoutResult.ok) return;

                const timeoutState = timeoutResult.state;
                const timeoutPayload = buildCallStatePayload(timeoutState);
                const rejectPayload = {
                    callId,
                    conversationId: timeoutState.conversationId,
                    from: timeoutState.recipientId,
                    to: timeoutState.initiatorId,
                    reason: "timeout" as const,
                };

                io.to(userRoom(timeoutState.initiatorId)).emit(SocketEvents.CALL_REJECT, rejectPayload);
                io.to(userRoom(timeoutState.recipientId)).emit(SocketEvents.CALL_REJECT, rejectPayload);
                io.to(userRoom(timeoutState.initiatorId)).emit(SocketEvents.CALL_STATE, timeoutPayload);
                io.to(userRoom(timeoutState.recipientId)).emit(SocketEvents.CALL_STATE, timeoutPayload);
            });
        }
    );

    socket.on(SocketEvents.CALL_OFFER, ({ to, offer }: CallOfferPayload) => {
        const from = socket.data.userId;
        if (!to) return;

        io.to(userRoom(to)).emit(SocketEvents.CALL_OFFER, {
            from,
            to,
            offer,
        });
    });

    socket.on(SocketEvents.CALL_ANSWER, async ({ to, answer, callId }: CallAnswerPayload) => {
        const from = socket.data.userId;
        if (!to) return;

        io.to(userRoom(to)).emit(SocketEvents.CALL_ANSWER, {
            callId,
            from,
            to,
            answer,
        });

        if (!callId) return;

        const activeResult = await markCallActive(redis, callId);
        if (!activeResult.ok) {
            emitCallError(socket, activeResult.message, { callId });
            return;
        }

        const activePayload = buildCallStatePayload(activeResult.state);
        io.to(userRoom(activeResult.state.initiatorId)).emit(SocketEvents.CALL_STATE, activePayload);
        io.to(userRoom(activeResult.state.recipientId)).emit(SocketEvents.CALL_STATE, activePayload);

        await refreshCallHeartbeat(redis, callId);
    });

    socket.on(SocketEvents.CALL_ICE_CANDIDATE, async ({ to, candidate, callId }: CallIceCandidatePayload) => {
        const from = socket.data.userId;
        if (!to) return;

        io.to(userRoom(to)).emit(SocketEvents.CALL_ICE_CANDIDATE, {
            callId,
            from,
            to,
            candidate,
        });

        if (callId) {
            await refreshCallHeartbeat(redis, callId);
        }
    });

    socket.on(SocketEvents.CALL_ACCEPT, async ({ callId, conversationId, to, acceptedAt, deviceId }: CallAcceptPayload) => {
        const from = socket.data.userId;
        if (!to) return;

        const result = await acceptCall(
            redis,
            {
                callId,
                conversationId,
                from,
                to,
                acceptedAt,
                deviceId,
            },
            from
        );

        if (!result.ok) {
            if (result.reason === "conflict") {
                io.to(userRoom(from)).emit(SocketEvents.CALL_BUSY, {
                    callId,
                    conversationId,
                    from: to,
                    to: from,
                });
            }
            emitCallError(socket, result.message, { callId, to });
            return;
        }

        clearCallTimeout(callId);

        io.to(userRoom(to)).emit(SocketEvents.CALL_ACCEPT, {
            callId,
            conversationId,
            from,
            to,
            acceptedAt: acceptedAt ?? new Date(),
            deviceId,
        });

        const statePayload = buildCallStatePayload(result.state);
        io.to(userRoom(result.state.initiatorId)).emit(SocketEvents.CALL_STATE, statePayload);
        io.to(userRoom(result.state.recipientId)).emit(SocketEvents.CALL_STATE, statePayload);

        await refreshCallHeartbeat(redis, callId);
    });

    socket.on(SocketEvents.CALL_REJECT, async ({ callId, conversationId, to, reason }: CallRejectPayload) => {
        const from = socket.data.userId;
        if (!to) return;

        const result = await rejectCall(
            redis,
            {
                callId,
                conversationId,
                from,
                to,
                reason,
            },
            from
        );

        if (!result.ok) {
            emitCallError(socket, result.message, { callId, to, reason });
            return;
        }

        clearCallTimeout(callId);

        io.to(userRoom(to)).emit(SocketEvents.CALL_REJECT, {
            callId,
            conversationId,
            from,
            to,
            reason,
        });

        const statePayload = buildCallStatePayload(result.state);
        io.to(userRoom(result.state.initiatorId)).emit(SocketEvents.CALL_STATE, statePayload);
        io.to(userRoom(result.state.recipientId)).emit(SocketEvents.CALL_STATE, statePayload);
    });

    socket.on(SocketEvents.CALL_END, async ({ callId, to, reason, endedAt }: CallEndPayload) => {
        const from = socket.data.userId;
        if (!to) return;

        if (!callId) {
            emitCallError(socket, "callId is required to end call", { to });
            return;
        }

        const result = await endCall(
            redis,
            {
                callId,
                from,
                to,
                reason,
                endedAt,
            },
            from
        );

        if (!result.ok) {
            emitCallError(socket, result.message, { callId, to });
            return;
        }

        clearCallTimeout(callId);

        io.to(userRoom(to)).emit(SocketEvents.CALL_END, {
            callId,
            from,
            to,
            reason,
            endedAt: endedAt ?? new Date(),
        });

        const statePayload = buildCallStatePayload(result.state);
        io.to(userRoom(result.state.initiatorId)).emit(SocketEvents.CALL_STATE, statePayload);
        io.to(userRoom(result.state.recipientId)).emit(SocketEvents.CALL_STATE, statePayload);
    });

    socket.on(SocketEvents.CALL_BUSY, ({ to }: CallRingingPayload) => {
        const from = socket.data.userId;
        if (!to) return;

        io.to(userRoom(to)).emit(SocketEvents.CALL_BUSY, {
            from,
            to,
        });
    });

    socket.on(SocketEvents.CALL_RECONNECT, async ({ to, callId, iceRestartRequired }) => {
        const from = socket.data.userId;
        if (!to) return;
        if (!callId) {
            emitCallError(socket, "callId is required for reconnect", { to });
            return;
        }

        if (iceRestartRequired) {
            const reconnectResult = await markCallReconnecting(redis, callId);
            if (!reconnectResult.ok) {
                emitCallError(socket, reconnectResult.message, { callId, to });
                return;
            }

            const reconnectStatePayload = buildCallStatePayload(reconnectResult.state);
            io.to(userRoom(reconnectResult.state.initiatorId)).emit(SocketEvents.CALL_STATE, reconnectStatePayload);
            io.to(userRoom(reconnectResult.state.recipientId)).emit(SocketEvents.CALL_STATE, reconnectStatePayload);

            scheduleReconnectGraceTimeout(callId, async () => {
                const expired = await expireReconnectGrace(redis, callId);
                if (!expired.ok) return;

                const statePayload = buildCallStatePayload(expired.state);
                io.to(userRoom(expired.state.initiatorId)).emit(SocketEvents.CALL_STATE, statePayload);
                io.to(userRoom(expired.state.recipientId)).emit(SocketEvents.CALL_STATE, statePayload);

                if (expired.state.status === "ended") {
                    io.to(userRoom(expired.state.initiatorId)).emit(SocketEvents.CALL_END, {
                        callId,
                        from,
                        to,
                        reason: "disconnect",
                        endedAt: new Date(),
                    });
                    io.to(userRoom(expired.state.recipientId)).emit(SocketEvents.CALL_END, {
                        callId,
                        from,
                        to,
                        reason: "disconnect",
                        endedAt: new Date(),
                    });
                }
            });
        } else {
            const resumed = await resumeCallFromReconnect(redis, callId);
            if (resumed.ok) {
                clearReconnectGraceTimeout(callId);
                const statePayload = buildCallStatePayload(resumed.state);
                io.to(userRoom(resumed.state.initiatorId)).emit(SocketEvents.CALL_STATE, statePayload);
                io.to(userRoom(resumed.state.recipientId)).emit(SocketEvents.CALL_STATE, statePayload);
            }

            await refreshCallHeartbeat(redis, callId);
        }

        io.to(userRoom(to)).emit(SocketEvents.CALL_RECONNECT, {
            callId,
            from,
            to,
            iceRestartRequired,
        });
    });
}