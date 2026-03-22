import { NextRequest, NextResponse } from "next/server";
import {
    authConfig,
    buildAccessTokenCookie,
    buildRefreshTokenCookie,
    refreshService,
} from "@chat/auth";

export async function POST(req: NextRequest) {
    try {
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
            return NextResponse.json({ success: false, error: "Refresh token is required" }, { status: 401 });
        }

        const tokens = await refreshService(refreshToken);

        const response = NextResponse.json({ success: true });
        response.headers.append("Set-Cookie", buildAccessTokenCookie(tokens.accessToken));
        response.headers.append("Set-Cookie", buildRefreshTokenCookie(tokens.refreshToken));

        return response;
    } catch (error) {
        if (error instanceof Error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 401 });
        }

        return NextResponse.json({ success: false, error: "Refresh failed" }, { status: 500 });
    }
}
