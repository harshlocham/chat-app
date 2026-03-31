import type { Redis } from "ioredis";
import type {
    CallAcceptPayload,
    CallEndPayload,
    CallOfferInitPayload,
    CallRejectPayload,
    CallState,
    CallStatePayload,
} from "@chat/types";
import {
    CALL_ACCEPT_LOCK_TTL_SECONDS,
    CALL_ACTIVE_TTL_SECONDS,
    CALL_RECONNECTING_TTL_SECONDS,
    CALL_RECONNECT_GRACE_SECONDS,
    CALL_RINGING_TTL_SECONDS,
    CALL_TERMINAL_TTL_SECONDS,
    redisKeys,
} from "../keys.js";

type PersistedCallState = {
    callId: string;
    conversationId: string;
    initiatorId: string;
    recipientId: string;
    status: CallState;
    updatedAt: string;
    acceptedBy?: string;
};

type OrchestrationResult =
    | { ok: true; state: PersistedCallState }
    | { ok: false; reason: "invalid" | "busy" | "conflict" | "not-found"; message: string };

const callTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const reconnectGraceTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const TERMINAL_STATES: ReadonlySet<CallState> = new Set([
    "ended",
    "rejected",
    "missed",
    "failed",
]);

const VALID_TRANSITIONS: Record<CallState, ReadonlySet<CallState>> = {
    initiated: new Set(["ringing", "failed"]),
    ringing: new Set(["accepted", "rejected", "missed", "failed"]),
    accepted: new Set(["active", "failed"]),
    active: new Set(["reconnecting", "ended", "failed"]),
    reconnecting: new Set(["active", "ended", "failed"]),
    ended: new Set(),
    rejected: new Set(),
    missed: new Set(),
    failed: new Set(),
};

function canTransition(from: CallState, to: CallState): boolean {
    return VALID_TRANSITIONS[from].has(to);
}

function safeParseCallState(raw: string | null): PersistedCallState | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as PersistedCallState;
    } catch {
        return null;
    }
}

function toStatePayload(state: PersistedCallState): CallStatePayload {
    return {
        callId: state.callId,
        conversationId: state.conversationId,
        status: state.status,
        participants: [
            { userId: state.initiatorId },
            {
                userId: state.recipientId,
                acceptedAt: state.acceptedBy ? state.updatedAt : undefined,
            },
        ],
        serverTs: state.updatedAt,
    };
}

async function loadCallState(redis: Redis, callId: string): Promise<PersistedCallState | null> {
    const raw = await redis.get(redisKeys.callState(callId));
    return safeParseCallState(raw);
}

async function persistCallState(
    redis: Redis,
    state: PersistedCallState,
    ttlSeconds: number
): Promise<void> {
    await redis.set(redisKeys.callState(state.callId), JSON.stringify(state), "EX", ttlSeconds);
}

async function clearUserActiveCallIfMatch(
    redis: Redis,
    userId: string,
    callId: string
): Promise<void> {
    const key = redisKeys.userActiveCall(userId);
    const activeCallId = await redis.get(key);
    if (activeCallId === callId) {
        await redis.del(key);
    }
}

export function isTerminalCallState(status: CallState): boolean {
    return TERMINAL_STATES.has(status);
}

export function scheduleCallTimeout(
    callId: string,
    onTimeout: () => Promise<void>,
    timeoutSeconds = CALL_RINGING_TTL_SECONDS
): void {
    clearCallTimeout(callId);
    const timeout = setTimeout(() => {
        void onTimeout();
    }, timeoutSeconds * 1000);
    callTimeouts.set(callId, timeout);
}

export function clearCallTimeout(callId: string): void {
    const timeout = callTimeouts.get(callId);
    if (!timeout) return;
    clearTimeout(timeout);
    callTimeouts.delete(callId);
}

export async function initiateCall(
    redis: Redis,
    payload: CallOfferInitPayload,
    actorId: string
): Promise<OrchestrationResult> {
    if (payload.from !== actorId) {
        return {
            ok: false,
            reason: "invalid",
            message: "Caller identity mismatch",
        };
    }

    const [callerActiveCall, recipientActiveCall] = await Promise.all([
        redis.get(redisKeys.userActiveCall(payload.from)),
        redis.get(redisKeys.userActiveCall(payload.to)),
    ]);

    if (callerActiveCall && callerActiveCall !== payload.callId) {
        return {
            ok: false,
            reason: "busy",
            message: "Caller is already in another call",
        };
    }

    if (recipientActiveCall && recipientActiveCall !== payload.callId) {
        return {
            ok: false,
            reason: "busy",
            message: "Recipient is already in another call",
        };
    }

    const state: PersistedCallState = {
        callId: payload.callId,
        conversationId: payload.conversationId,
        initiatorId: payload.from,
        recipientId: payload.to,
        status: "ringing",
        updatedAt: new Date().toISOString(),
    };

    await redis
        .multi()
        .set(redisKeys.callState(payload.callId), JSON.stringify(state), "EX", CALL_RINGING_TTL_SECONDS)
        .sadd(redisKeys.callParticipants(payload.callId), payload.from, payload.to)
        .set(redisKeys.userActiveCall(payload.from), payload.callId, "EX", CALL_RINGING_TTL_SECONDS)
        .set(redisKeys.userActiveCall(payload.to), payload.callId, "EX", CALL_RINGING_TTL_SECONDS)
        .del(redisKeys.callAcceptedBy(payload.callId))
        .del(redisKeys.callAcceptLock(payload.callId))
        .exec();

    return { ok: true, state };
}

export async function acceptCall(
    redis: Redis,
    payload: CallAcceptPayload,
    actorId: string
): Promise<OrchestrationResult> {
    if (payload.from !== actorId) {
        return {
            ok: false,
            reason: "invalid",
            message: "Acceptor identity mismatch",
        };
    }

    const lockKey = redisKeys.callAcceptLock(payload.callId);
    const lockAcquired = await redis.setnx(lockKey, actorId);
    if (lockAcquired !== 1) {
        return {
            ok: false,
            reason: "conflict",
            message: "Call was already accepted on another device",
        };
    }

    await redis.expire(lockKey, CALL_ACCEPT_LOCK_TTL_SECONDS);

    const existing = await loadCallState(redis, payload.callId);
    if (!existing) {
        return {
            ok: false,
            reason: "not-found",
            message: "Call state not found",
        };
    }

    if (!canTransition(existing.status, "accepted")) {
        return {
            ok: false,
            reason: "invalid",
            message: `Cannot accept call in state ${existing.status}`,
        };
    }

    const nextState: PersistedCallState = {
        ...existing,
        status: "accepted",
        acceptedBy: payload.from,
        updatedAt: new Date().toISOString(),
    };

    await redis
        .multi()
        .set(redisKeys.callState(payload.callId), JSON.stringify(nextState), "EX", CALL_ACTIVE_TTL_SECONDS)
        .set(redisKeys.callAcceptedBy(payload.callId), payload.from, "EX", CALL_ACTIVE_TTL_SECONDS)
        .set(redisKeys.userActiveCall(existing.initiatorId), payload.callId, "EX", CALL_ACTIVE_TTL_SECONDS)
        .set(redisKeys.userActiveCall(existing.recipientId), payload.callId, "EX", CALL_ACTIVE_TTL_SECONDS)
        .exec();

    return { ok: true, state: nextState };
}

export async function markCallActive(redis: Redis, callId: string): Promise<OrchestrationResult> {
    const existing = await loadCallState(redis, callId);
    if (!existing) {
        return {
            ok: false,
            reason: "not-found",
            message: "Call state not found",
        };
    }

    if (!canTransition(existing.status, "active") && existing.status !== "active") {
        return {
            ok: false,
            reason: "invalid",
            message: `Cannot move call to active from ${existing.status}`,
        };
    }

    const nextState: PersistedCallState = {
        ...existing,
        status: "active",
        updatedAt: new Date().toISOString(),
    };

    await persistCallState(redis, nextState, CALL_ACTIVE_TTL_SECONDS);
    return { ok: true, state: nextState };
}

export async function rejectCall(
    redis: Redis,
    payload: CallRejectPayload,
    actorId: string
): Promise<OrchestrationResult> {
    if (payload.from !== actorId) {
        return {
            ok: false,
            reason: "invalid",
            message: "Rejector identity mismatch",
        };
    }

    const existing = await loadCallState(redis, payload.callId);
    if (!existing) {
        return {
            ok: false,
            reason: "not-found",
            message: "Call state not found",
        };
    }

    if (!canTransition(existing.status, "rejected")) {
        return {
            ok: false,
            reason: "invalid",
            message: `Cannot reject call in state ${existing.status}`,
        };
    }

    const nextState: PersistedCallState = {
        ...existing,
        status: "rejected",
        updatedAt: new Date().toISOString(),
    };

    await persistCallState(redis, nextState, CALL_TERMINAL_TTL_SECONDS);
    await clearUserActiveCallIfMatch(redis, existing.initiatorId, payload.callId);
    await clearUserActiveCallIfMatch(redis, existing.recipientId, payload.callId);
    await redis.del(redisKeys.callAcceptLock(payload.callId));

    return { ok: true, state: nextState };
}

export async function endCall(
    redis: Redis,
    payload: CallEndPayload,
    actorId: string
): Promise<OrchestrationResult> {
    if (payload.from !== actorId) {
        return {
            ok: false,
            reason: "invalid",
            message: "Call end actor mismatch",
        };
    }

    if (!payload.callId) {
        return {
            ok: false,
            reason: "invalid",
            message: "callId is required to end call",
        };
    }

    const existing = await loadCallState(redis, payload.callId);
    if (!existing) {
        return {
            ok: false,
            reason: "not-found",
            message: "Call state not found",
        };
    }

    if (isTerminalCallState(existing.status)) {
        return { ok: true, state: existing };
    }

    if (!canTransition(existing.status, "ended") && existing.status !== "ended") {
        return {
            ok: false,
            reason: "invalid",
            message: `Cannot end call in state ${existing.status}`,
        };
    }

    const nextState: PersistedCallState = {
        ...existing,
        status: "ended",
        updatedAt: new Date().toISOString(),
    };

    await persistCallState(redis, nextState, CALL_TERMINAL_TTL_SECONDS);
    await clearUserActiveCallIfMatch(redis, existing.initiatorId, payload.callId);
    await clearUserActiveCallIfMatch(redis, existing.recipientId, payload.callId);
    await redis.del(redisKeys.callAcceptLock(payload.callId));

    return { ok: true, state: nextState };
}

export async function timeoutCall(redis: Redis, callId: string): Promise<OrchestrationResult> {
    const existing = await loadCallState(redis, callId);
    if (!existing) {
        return {
            ok: false,
            reason: "not-found",
            message: "Call state not found",
        };
    }

    if (isTerminalCallState(existing.status)) {
        return { ok: true, state: existing };
    }

    if (!canTransition(existing.status, "missed")) {
        return {
            ok: false,
            reason: "invalid",
            message: `Cannot mark call as missed from ${existing.status}`,
        };
    }

    const nextState: PersistedCallState = {
        ...existing,
        status: "missed",
        updatedAt: new Date().toISOString(),
    };

    await persistCallState(redis, nextState, CALL_TERMINAL_TTL_SECONDS);
    await clearUserActiveCallIfMatch(redis, existing.initiatorId, callId);
    await clearUserActiveCallIfMatch(redis, existing.recipientId, callId);
    await redis.del(redisKeys.callAcceptLock(callId));

    return { ok: true, state: nextState };
}

export function buildCallStatePayload(state: PersistedCallState): CallStatePayload {
    return toStatePayload(state);
}

export function scheduleReconnectGraceTimeout(
    callId: string,
    onGraceExpired: () => Promise<void>,
    gracePeriodSeconds = CALL_RECONNECT_GRACE_SECONDS
): void {
    clearReconnectGraceTimeout(callId);
    const timeout = setTimeout(() => {
        void onGraceExpired();
    }, gracePeriodSeconds * 1000);
    reconnectGraceTimeouts.set(callId, timeout);
}

export function clearReconnectGraceTimeout(callId: string): void {
    const timeout = reconnectGraceTimeouts.get(callId);
    if (!timeout) return;
    clearTimeout(timeout);
    reconnectGraceTimeouts.delete(callId);
}

export async function markCallReconnecting(
    redis: Redis,
    callId: string
): Promise<OrchestrationResult> {
    const existing = await loadCallState(redis, callId);
    if (!existing) {
        return {
            ok: false,
            reason: "not-found",
            message: "Call state not found",
        };
    }

    if (!canTransition(existing.status, "reconnecting")) {
        return {
            ok: false,
            reason: "invalid",
            message: `Cannot reconnect call in state ${existing.status}`,
        };
    }

    const nextState: PersistedCallState = {
        ...existing,
        status: "reconnecting",
        updatedAt: new Date().toISOString(),
    };

    await redis
        .multi()
        .set(redisKeys.callState(callId), JSON.stringify(nextState), "EX", CALL_RECONNECTING_TTL_SECONDS)
        .set(redisKeys.callReconnecting(callId), "1", "EX", CALL_RECONNECT_GRACE_SECONDS)
        .exec();

    return { ok: true, state: nextState };
}

export async function resumeCallFromReconnect(
    redis: Redis,
    callId: string
): Promise<OrchestrationResult> {
    const existing = await loadCallState(redis, callId);
    if (!existing) {
        return {
            ok: false,
            reason: "not-found",
            message: "Call state not found",
        };
    }

    if (existing.status !== "reconnecting") {
        return {
            ok: false,
            reason: "invalid",
            message: `Cannot resume from non-reconnecting state: ${existing.status}`,
        };
    }

    const nextState: PersistedCallState = {
        ...existing,
        status: "active",
        updatedAt: new Date().toISOString(),
    };

    await persistCallState(redis, nextState, CALL_ACTIVE_TTL_SECONDS);
    await redis.del(redisKeys.callReconnecting(callId));

    return { ok: true, state: nextState };
}

export async function refreshCallHeartbeat(
    redis: Redis,
    callId: string
): Promise<OrchestrationResult> {
    const existing = await loadCallState(redis, callId);
    if (!existing) {
        return {
            ok: false,
            reason: "not-found",
            message: "Call state not found",
        };
    }

    if (isTerminalCallState(existing.status)) {
        return { ok: true, state: existing };
    }

    const ttl =
        existing.status === "ringing"
            ? CALL_RINGING_TTL_SECONDS
            : existing.status === "reconnecting"
              ? CALL_RECONNECTING_TTL_SECONDS
              : CALL_ACTIVE_TTL_SECONDS;

    await redis.expire(redisKeys.callState(callId), ttl);
    await redis.expire(redisKeys.userActiveCall(existing.initiatorId), ttl);
    await redis.expire(redisKeys.userActiveCall(existing.recipientId), ttl);

    return { ok: true, state: existing };
}

export async function expireReconnectGrace(redis: Redis, callId: string): Promise<OrchestrationResult> {
    const existing = await loadCallState(redis, callId);
    if (!existing) {
        return {
            ok: false,
            reason: "not-found",
            message: "Call state not found",
        };
    }

    if (existing.status !== "reconnecting") {
        return { ok: true, state: existing };
    }

    const nextState: PersistedCallState = {
        ...existing,
        status: "ended",
        updatedAt: new Date().toISOString(),
    };

    await persistCallState(redis, nextState, CALL_TERMINAL_TTL_SECONDS);
    await clearUserActiveCallIfMatch(redis, existing.initiatorId, callId);
    await clearUserActiveCallIfMatch(redis, existing.recipientId, callId);

    return { ok: true, state: nextState };
}
