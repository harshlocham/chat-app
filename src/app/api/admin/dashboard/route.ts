import { NextResponse } from "next/server";
import { createClient } from "redis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/auth/auth";

const redis = createClient({
    url: process.env.REDIS_URL,
});

/**
 * Ensure the shared Redis client is connected.
 *
 * Does nothing if the client is already open; otherwise establishes a connection.
 */
async function connectRedis() {
    if (!redis.isOpen) {
        await redis.connect();
    }
}

/**
 * Handle GET requests for the admin dashboard and return aggregated usage metrics.
 *
 * Ensures the requester is an authenticated user with the "admin" role, fetches
 * dashboard counts from Redis, and returns them in the response body.
 *
 * @returns A NextResponse with JSON:
 * - On success: `{ success: true, data: { activeUsers: number, totalMessagesToday: number } }`
 * - On unauthorized: `{ error: "Unauthorized" }` with HTTP 401
 * - On forbidden: `{ error: "Forbidden" }` with HTTP 403
 * - On internal error: `{ success: false, error: "Failed to fetch dashboard data" }` with HTTP 500
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check for admin role
        if (session.user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        await connectRedis();

        const [activeUsers, totalMessagesTodayRaw] = await Promise.all([
            redis.sCard("active_users"),
            redis.get("total_messages_today"),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                activeUsers: activeUsers ?? 0,
                totalMessagesToday: Number(totalMessagesTodayRaw ?? 0),
            },
        });
    } catch (err) {
        console.error("Dashboard API Error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to fetch dashboard data" },
            { status: 500 }
        );
    }
}