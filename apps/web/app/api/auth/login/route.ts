import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/Db/db";
import { authLoginRateLimiter } from "@/lib/utils/rateLimiter";
import {
    buildAccessTokenCookie,
    buildRefreshTokenCookie,
    loginUser,
} from "@chat/auth";

function safeIpAddress(req: NextRequest): string {
    const xForwardedFor = req.headers.get("x-forwarded-for") || "";
    return xForwardedFor.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
    try {
        const { success } = await authLoginRateLimiter.limit(safeIpAddress(req));
        if (!success) {
            return NextResponse.json(
                { success: false, error: "Too many login attempts. Try again later." },
                { status: 429 }
            );
        }

        const body = await req.json();
        const email = String(body?.email || "").trim();
        const password = String(body?.password || "");

        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: "Email and password are required" },
                { status: 400 }
            );
        }

        await connectToDatabase();

        const { user, accessToken, refreshToken } = await loginUser({
            email,
            password,
            userAgent: req.headers.get("user-agent") || undefined,
            ipAddress: safeIpAddress(req),
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
            const status =
                error.message === "User not found" ||
                    error.message === "Invalid password" ||
                    error.message === "Account is banned"
                    ? 401
                    : 400;

            return NextResponse.json({ success: false, error: error.message }, { status });
        }

        return NextResponse.json({ success: false, error: "Login failed" }, { status: 500 });
    }
}
