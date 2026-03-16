import { NextResponse } from "next/server";
import { createClient } from "redis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/auth/auth";

const redis = createClient({
    url: process.env.REDIS_URL,
});

async function connectRedis() {
    if (!redis.isOpen) {
        await redis.connect();
    }
}

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
