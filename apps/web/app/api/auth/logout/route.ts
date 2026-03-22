import { NextRequest, NextResponse } from "next/server";
import {
    authConfig,
    buildExpiredCookie,
    logoutService,
} from "@chat/auth";

export async function POST(req: NextRequest) {
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
            await logoutService({
                refreshToken,
                logoutFromAllDevices,
            });
        } catch {
            // Always clear client cookies even if session was already invalid.
        }
    }

    const response = NextResponse.json({ success: true });
    response.headers.append("Set-Cookie", buildExpiredCookie(authConfig.cookie.accessToken));
    response.headers.append("Set-Cookie", buildExpiredCookie(authConfig.cookie.refreshToken));

    return response;
}
