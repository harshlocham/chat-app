import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/Db/db";
import { authLoginRateLimiter } from "@/lib/utils/rateLimiter";
import {
    buildAccessTokenCookie,
    buildRefreshTokenCookie,
    logAuthEventBestEffort,
    loginUser,
} from "@chat/auth";

function safeIpAddress(req: NextRequest): string {
    const xForwardedFor = req.headers.get("x-forwarded-for") || "";
    return xForwardedFor.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
    const ipAddress = safeIpAddress(req);
    const userAgent = req.headers.get("user-agent") || undefined;

    try {
        const { success } = await authLoginRateLimiter.limit(ipAddress);
        if (!success) {
            await logAuthEventBestEffort({
                eventType: "login_failed",
                outcome: "failure",
                ipAddress,
                userAgent,
                reason: "rate_limited",
            });
            return NextResponse.json(
                { success: false, error: "Too many login attempts. Try again later." },
                { status: 429 }
            );
        }

        const body = await req.json();
        const email = String(body?.email || "").trim();
        const password = String(body?.password || "");

        if (!email || !password) {
            await logAuthEventBestEffort({
                eventType: "login_failed",
                outcome: "failure",
                email,
                ipAddress,
                userAgent,
                reason: "missing_credentials",
            });
            return NextResponse.json(
                { success: false, error: "Email and password are required" },
                { status: 400 }
            );
        }

        await connectToDatabase();

        const { user, accessToken, refreshToken } = await loginUser({
            email,
            password,
            userAgent,
            ipAddress,
        });

        await logAuthEventBestEffort({
            eventType: "login_success",
            outcome: "success",
            userId: user._id.toString(),
            email: user.email,
            ipAddress,
            userAgent,
        });

        const response = NextResponse.json({
            success: true,
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                role: user.role,
                status: user.status,
                profilePicture: user.profilePicture || null,
            },
        });

        response.headers.append("Set-Cookie", buildAccessTokenCookie(accessToken));
        response.headers.append("Set-Cookie", buildRefreshTokenCookie(refreshToken));

        return response;
    } catch (error) {
        if (error instanceof Error) {
            await logAuthEventBestEffort({
                eventType: "login_failed",
                outcome: "failure",
                ipAddress,
                userAgent,
                reason: error.message,
            });
            const status =
                error.message === "User not found" ||
                    error.message === "Invalid password" ||
                    error.message === "Account is banned"
                    ? 401
                    : 400;

            return NextResponse.json({ success: false, error: error.message }, { status });
        }

        await logAuthEventBestEffort({
            eventType: "login_failed",
            outcome: "failure",
            ipAddress,
            userAgent,
            reason: "unknown_error",
        });
        return NextResponse.json({ success: false, error: "Login failed" }, { status: 500 });
    }
}
