import type { Redis } from "ioredis";
import {
    MESSAGE_DELIVERY_TTL_SECONDS,
    PRESENCE_HEARTBEAT_TTL_SECONDS,
    redisKeys,
    type MessageDeliveryState,
} from "../keys.js";

type PresenceSnapshot = {
    onlineUsers: string[];
    staleUsers: string[];
};

async function clearPresenceState(redis: Redis, userId: string) {
    await redis
        .multi()
        .del(redisKeys.userSockets(userId))
        .del(redisKeys.onlineUser(userId))
        .del(redisKeys.userActiveConversation(userId))
        .del(redisKeys.userPresence(userId))
        .srem(redisKeys.activeUsersSet, userId)
        .exec();
}

async function getPresenceSnapshot(redis: Redis): Promise<PresenceSnapshot> {
    const userIds = await redis.smembers(redisKeys.activeUsersSet);
    if (userIds.length === 0) {
        return { onlineUsers: [], staleUsers: [] };
    }

    const pipeline = redis.pipeline();
    for (const userId of userIds) {
        pipeline.exists(redisKeys.userPresence(userId));
        pipeline.scard(redisKeys.userSockets(userId));
    }

    const results = await pipeline.exec();
    if (!results) {
        return { onlineUsers: [], staleUsers: userIds };
    }

    const onlineUsers: string[] = [];
    const staleUsers: string[] = [];

    for (let index = 0; index < userIds.length; index += 1) {
        const userId = userIds[index];
        const heartbeatResult = results[index * 2];
        const socketsCountResult = results[index * 2 + 1];

        const heartbeatExists = Number(heartbeatResult?.[1] ?? 0) > 0;
        const socketCount = Number(socketsCountResult?.[1] ?? 0);

        if (heartbeatExists && socketCount > 0) {
            onlineUsers.push(userId);
        } else {
            staleUsers.push(userId);
        }
    }

    return { onlineUsers, staleUsers };
}

export async function trackSocketConnected(redis: Redis, userId: string, socketId: string) {
    await redis
        .multi()
        .set(redisKeys.onlineUser(userId), socketId)
        .sadd(redisKeys.userSockets(userId), socketId)
        .set(
            redisKeys.userPresence(userId),
            "online",
            "EX",
            PRESENCE_HEARTBEAT_TTL_SECONDS
        )
        .sadd(redisKeys.activeUsersSet, userId)
        .exec();

    const socketCount = await redis.scard(redisKeys.userSockets(userId));
    return { socketCount, becameOnline: socketCount === 1 };
}

export async function trackSocketDisconnected(redis: Redis, userId: string, socketId: string) {
    await redis.srem(redisKeys.userSockets(userId), socketId);

    const socketCount = await redis.scard(redisKeys.userSockets(userId));
    if (socketCount > 0) {
        const replacementSocketId = await redis.srandmember(redisKeys.userSockets(userId));
        if (replacementSocketId) {
            await redis.set(redisKeys.onlineUser(userId), replacementSocketId);
        }
        return { socketCount, wentOffline: false };
    }

    await redis
        .multi()
        .del(redisKeys.userSockets(userId))
        .del(redisKeys.onlineUser(userId))
        .del(redisKeys.userActiveConversation(userId))
        .del(redisKeys.userPresence(userId))
        .srem(redisKeys.activeUsersSet, userId)
        .exec();

    return { socketCount: 0, wentOffline: true };
}

export async function refreshPresence(redis: Redis, userId: string) {
    await redis.set(
        redisKeys.userPresence(userId),
        "online",
        "EX",
        PRESENCE_HEARTBEAT_TTL_SECONDS
    );
}

export async function setActiveConversation(redis: Redis, userId: string, conversationId: string) {
    await redis.set(redisKeys.userActiveConversation(userId), conversationId);
}

export async function clearActiveConversation(redis: Redis, userId: string, conversationId?: string) {
    if (!conversationId) {
        await redis.del(redisKeys.userActiveConversation(userId));
        return;
    }

    const current = await redis.get(redisKeys.userActiveConversation(userId));
    if (current === conversationId) {
        await redis.del(redisKeys.userActiveConversation(userId));
    }
}

export async function getActiveConversation(redis: Redis, userId: string) {
    return redis.get(redisKeys.userActiveConversation(userId));
}

export async function getActiveUsers(redis: Redis) {
    const snapshot = await getPresenceSnapshot(redis);

    if (snapshot.staleUsers.length > 0) {
        for (const staleUserId of snapshot.staleUsers) {
            await clearPresenceState(redis, staleUserId);
        }
    }

    return snapshot.onlineUsers;
}

export async function cleanupStaleActiveUsers(redis: Redis) {
    const snapshot = await getPresenceSnapshot(redis);

    if (snapshot.staleUsers.length > 0) {
        for (const staleUserId of snapshot.staleUsers) {
            await clearPresenceState(redis, staleUserId);
        }
    }

    return snapshot.staleUsers;
}

export async function isUserOnline(redis: Redis, userId: string) {
    const [count, heartbeat] = await Promise.all([
        redis.scard(redisKeys.userSockets(userId)),
        redis.get(redisKeys.userPresence(userId)),
    ]);

    return count > 0 && Boolean(heartbeat);
}

export async function setMessageDeliveryState(
    redis: Redis,
    messageId: string,
    state: MessageDeliveryState
) {
    await redis.set(
        redisKeys.messageDelivery(messageId),
        state,
        "EX",
        MESSAGE_DELIVERY_TTL_SECONDS
    );
}

export async function getMessageDeliveryState(redis: Redis, messageId: string) {
    return redis.get(redisKeys.messageDelivery(messageId));
}
