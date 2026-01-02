import { createClient, RedisClientType } from "redis";

export interface RedisAdapterClients {
    pubClient: RedisClientType;
    subClient: RedisClientType;
}

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