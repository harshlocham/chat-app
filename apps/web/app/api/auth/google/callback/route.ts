import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/Db/db";
import {
    buildAccessTokenCookie,
    buildRefreshTokenCookie,
    loginWithGoogleCode,
} from "@chat/auth";

const GOOGLE_STATE_COOKIE = "google_oauth_state";
const GOOGLE_CALLBACK_COOKIE = "google_oauth_callback";

function getAppBaseUrl(req: NextRequest): string {
    return (
        process.env.APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        req.nextUrl.origin
    );
}

function getRedirectUri(req: NextRequest): string {
    return `${getAppBaseUrl(req)}/api/auth/google/callback`;
}

function cleanupOAuthCookies(response: NextResponse) {
    response.cookies.set({
        name: GOOGLE_STATE_COOKIE,
        value: "",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
    });

    response.cookies.set({
        name: GOOGLE_CALLBACK_COOKIE,
        value: "",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
    });
}

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");

    const storedState = req.cookies.get(GOOGLE_STATE_COOKIE)?.value;
    const callbackCookie = req.cookies.get(GOOGLE_CALLBACK_COOKIE)?.value;
    const callbackUrl = callbackCookie ? decodeURIComponent(callbackCookie) : "/";

    const loginRedirect = new URL("/login", req.url);

    if (!code || !state || !storedState || state !== storedState) {
        loginRedirect.searchParams.set("error", "google_oauth_state");
        const response = NextResponse.redirect(loginRedirect);
        cleanupOAuthCookies(response);
        return response;
    }

    try {
        await connectToDatabase();

        const xForwardedFor = req.headers.get("x-forwarded-for") || "";
        const ipAddress = xForwardedFor.split(",")[0]?.trim() || "unknown";
        const userAgent = req.headers.get("user-agent") || undefined;

        const { accessToken, refreshToken } = await loginWithGoogleCode({
            code,
            redirectUri: getRedirectUri(req),
            userAgent,
            ipAddress,
        });

        const safeRedirect = callbackUrl.startsWith("/") ? callbackUrl : "/";
        const response = NextResponse.redirect(new URL(safeRedirect, req.url));
        cleanupOAuthCookies(response);
        response.headers.append("Set-Cookie", buildAccessTokenCookie(accessToken));
        response.headers.append("Set-Cookie", buildRefreshTokenCookie(refreshToken));

        return response;
    } catch (error) {
        const message = error instanceof Error ? error.message : "google_oauth_failed";
        loginRedirect.searchParams.set("error", message);
        const response = NextResponse.redirect(loginRedirect);
        cleanupOAuthCookies(response);
        return response;
    }
}
