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

export const authRateLimiter = new InMemoryRateLimiter(60_000, 5);
export const messageRateLimiter = new InMemoryRateLimiter(10_000, 20);
