import { NextRequest, NextResponse } from "next/server";
import { authLogoutRateLimiter } from "@/lib/utils/rateLimiter";
import {
    authConfig,
    buildExpiredCookie,
    logAuthEventBestEffort,
    logoutService,
} from "@chat/auth";

export async function POST(req: NextRequest) {
    const xForwardedFor = req.headers.get("x-forwarded-for") || "";
    const ipAddress = xForwardedFor.split(",")[0]?.trim() || "unknown";
    const userAgent = req.headers.get("user-agent") || undefined;
    const { success } = await authLogoutRateLimiter.limit(ipAddress);
    if (!success) {
        await logAuthEventBestEffort({
            eventType: "logout_failed",
            outcome: "failure",
            ipAddress,
            userAgent,
            reason: "rate_limited",
        });
        return NextResponse.json(
            { success: false, error: "Too many logout attempts. Try again later." },
            { status: 429 }
        );
    }

    let logoutFromAllDevices = false;
    let bodyRefreshToken = "";

    try {
        const body = await req.json();
        logoutFromAllDevices = Boolean(body?.logoutFromAllDevices);
        bodyRefreshToken = String(body?.refreshToken || "");
    } catch {
        logoutFromAllDevices = false;
        bodyRefreshToken = "";
    }

    const cookieRefreshToken = req.cookies.get(authConfig.cookie.refreshToken)?.value || "";
    const refreshToken = bodyRefreshToken || cookieRefreshToken;

    if (refreshToken) {
        try {
            const result = await logoutService({
                refreshToken,
                logoutFromAllDevices,
            });
            await logAuthEventBestEffort({
                eventType: "logout_success",
                outcome: "success",
                userId: result.userId,
                ipAddress,
                userAgent,
                metadata: {
                    allDevices: result.allDevices,
                    sessionId: result.sessionId,
                },
            });
        } catch (error) {
            await logAuthEventBestEffort({
                eventType: "logout_failed",
                outcome: "failure",
                ipAddress,
                userAgent,
                reason: error instanceof Error ? error.message : "logout_failed",
            });
            // Always clear client cookies even if session was already invalid.
        }
    } else {
        await logAuthEventBestEffort({
            eventType: "logout_failed",
            outcome: "failure",
            ipAddress,
            userAgent,
            reason: "missing_refresh_token",
        });
    }

    const response = NextResponse.json({ success: true });
    response.headers.append("Set-Cookie", buildExpiredCookie(authConfig.cookie.accessToken));
    response.headers.append("Set-Cookie", buildExpiredCookie(authConfig.cookie.refreshToken));

    return response;
}
