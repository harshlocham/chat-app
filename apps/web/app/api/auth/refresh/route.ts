import { NextRequest, NextResponse } from "next/server";
import { authRefreshRateLimiter } from "@/lib/utils/rateLimiter";
import {
    authConfig,
    buildAccessTokenCookie,
    buildRefreshTokenCookie,
    logAuthEventBestEffort,
    refreshService,
} from "@chat/auth";

export async function POST(req: NextRequest) {
    const xForwardedFor = req.headers.get("x-forwarded-for") || "";
    const ipAddress = xForwardedFor.split(",")[0]?.trim() || "unknown";
    const userAgent = req.headers.get("user-agent") || undefined;

    try {
        const { success } = await authRefreshRateLimiter.limit(ipAddress);
        if (!success) {
            await logAuthEventBestEffort({
                eventType: "refresh_failed",
                outcome: "failure",
                ipAddress,
                userAgent,
                reason: "rate_limited",
            });
            return NextResponse.json(
                { success: false, error: "Too many refresh attempts. Try again later." },
                { status: 429 }
            );
        }

        let bodyRefreshToken = "";

        try {
            const body = await req.json();
            bodyRefreshToken = String(body?.refreshToken || "");
        } catch {
            bodyRefreshToken = "";
        }

        const cookieRefreshToken = req.cookies.get(authConfig.cookie.refreshToken)?.value || "";
        const refreshToken = bodyRefreshToken || cookieRefreshToken;

        if (!refreshToken) {
            await logAuthEventBestEffort({
                eventType: "refresh_failed",
                outcome: "failure",
                ipAddress,
                userAgent,
                reason: "missing_refresh_token",
            });
            return NextResponse.json({ success: false, error: "Refresh token is required" }, { status: 401 });
        }

        const tokens = await refreshService({
            refreshToken,
            userAgent,
            ipAddress,
        });

        await logAuthEventBestEffort({
            eventType: "refresh_success",
            outcome: "success",
            userId: tokens.userId,
            ipAddress,
            userAgent,
            metadata: { sessionId: tokens.sessionId },
        });

        const response = NextResponse.json({ success: true });
        response.headers.append("Set-Cookie", buildAccessTokenCookie(tokens.accessToken));
        response.headers.append("Set-Cookie", buildRefreshTokenCookie(tokens.refreshToken));

        return response;
    } catch (error) {
        if (error instanceof Error) {
            await logAuthEventBestEffort({
                eventType: "refresh_failed",
                outcome: "failure",
                ipAddress,
                userAgent,
                reason: error.message,
            });
            return NextResponse.json({ success: false, error: error.message }, { status: 401 });
        }

        await logAuthEventBestEffort({
            eventType: "refresh_failed",
            outcome: "failure",
            ipAddress,
            userAgent,
            reason: "unknown_error",
        });
        return NextResponse.json({ success: false, error: "Refresh failed" }, { status: 500 });
    }
}
