import { createClient, RedisClientType } from "redis";

export interface RedisAdapterClients {
    pubClient: RedisClientType;
    subClient: RedisClientType;
}

/**
 * Initialize and connect a pair of Redis clients for publishing and subscribing.
 *
 * Creates a publisher client using the `REDIS_URL` environment variable and a subscriber client by duplicating the publisher, attaches error handlers, and connects both clients.
 *
 * @returns An object with `pubClient` (publisher Redis client) and `subClient` (subscriber Redis client)
 */
export async function initRedis(): Promise<RedisAdapterClients> {
    const pubClient: RedisClientType = createClient({
        url: process.env.REDIS_URL,
    });

    const subClient: RedisClientType = pubClient.duplicate();

    pubClient.on("error", (err) =>
        console.error("❌ Redis Pub Error:", err)
    );
    subClient.on("error", (err) =>
        console.error("❌ Redis Sub Error:", err)
    );

    await Promise.all([pubClient.connect(), subClient.connect()]);

    console.log("✅ Redis clients connected");

    return { pubClient, subClient };
}