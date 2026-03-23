import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitResult = {
    success: boolean;
    remaining: number;
    reset: number;
};

type Bucket = {
    count: number;
    resetAt: number;
};

class InMemoryRateLimiter {
    private readonly windowMs: number;
    private readonly max: number;
    private readonly buckets = new Map<string, Bucket>();

    constructor(windowMs: number, max: number) {
        this.windowMs = windowMs;
        this.max = max;
    }

    async limit(key: string): Promise<RateLimitResult> {
        const now = Date.now();
        const existing = this.buckets.get(key);

        if (!existing || existing.resetAt <= now) {
            const resetAt = now + this.windowMs;
            this.buckets.set(key, { count: 1, resetAt });
            return { success: true, remaining: this.max - 1, reset: resetAt };
        }

        existing.count += 1;
        this.buckets.set(key, existing);

        return {
            success: existing.count <= this.max,
            remaining: Math.max(this.max - existing.count, 0),
            reset: existing.resetAt,
        };
    }
}

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

let upstashRedisClient: Redis | null = null;
if (upstashUrl && upstashToken) {
    upstashRedisClient = new Redis({
        url: upstashUrl,
        token: upstashToken,
    });
}

class HybridRateLimiter {
    private readonly inMemoryLimiter: InMemoryRateLimiter;
    private readonly upstashLimiter: Ratelimit | null;

    constructor(prefix: string, windowMs: number, max: number) {
        this.inMemoryLimiter = new InMemoryRateLimiter(windowMs, max);

        if (!upstashRedisClient) {
            this.upstashLimiter = null;
            return;
        }

        const windowSeconds = Math.max(Math.ceil(windowMs / 1000), 1);
        this.upstashLimiter = new Ratelimit({
            redis: upstashRedisClient,
            limiter: Ratelimit.fixedWindow(max, `${windowSeconds} s`),
            prefix,
        });
    }

    async limit(key: string): Promise<RateLimitResult> {
        if (!this.upstashLimiter) {
            return this.inMemoryLimiter.limit(key);
        }

        try {
            const result = await this.upstashLimiter.limit(key);
            return {
                success: result.success,
                remaining: result.remaining,
                reset: result.reset,
            };
        } catch {
            // Fail closed from a reliability perspective with a local fallback
            // so auth endpoints remain available if the Redis network path is down.
            return this.inMemoryLimiter.limit(key);
        }
    }
}

export const authRateLimiter = new HybridRateLimiter("rl:auth", 60_000, 5);
export const authLoginRateLimiter = new HybridRateLimiter("rl:auth:login", 60_000, 10);
export const authRegisterRateLimiter = new HybridRateLimiter("rl:auth:register", 10 * 60_000, 5);
export const authRefreshRateLimiter = new HybridRateLimiter("rl:auth:refresh", 60_000, 20);
export const authLogoutRateLimiter = new HybridRateLimiter("rl:auth:logout", 60_000, 10);
export const authGoogleCallbackRateLimiter = new HybridRateLimiter("rl:auth:google", 60_000, 20);
export const messageRateLimiter = new HybridRateLimiter("rl:message", 10_000, 20);
export const internalSocketAuthzRateLimiter = new HybridRateLimiter("rl:internal:socket-authz", 10_000, 80);
