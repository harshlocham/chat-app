import { NextRequest, NextResponse } from "next/server";
import { buildGoogleOAuthAuthorizeUrl, createGoogleOAuthState } from "@chat/auth";

const GOOGLE_STATE_COOKIE = "google_oauth_state";
const GOOGLE_CALLBACK_COOKIE = "google_oauth_callback";

function getAppBaseUrl(req: NextRequest): string {
    return (
        process.env.APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        req.nextUrl.origin
    );
}

export async function GET(req: NextRequest) {
    try {
        const callbackUrl = req.nextUrl.searchParams.get("callbackUrl") || "/";
        const baseUrl = getAppBaseUrl(req);
        const redirectUri = `${baseUrl}/api/auth/google/callback`;
        const state = createGoogleOAuthState();

        const authUrl = buildGoogleOAuthAuthorizeUrl({
            redirectUri,
            state,
        });

        const response = NextResponse.redirect(authUrl);
        response.cookies.set({
            name: GOOGLE_STATE_COOKIE,
            value: state,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 10 * 60,
        });

        response.cookies.set({
            name: GOOGLE_CALLBACK_COOKIE,
            value: encodeURIComponent(callbackUrl),
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 10 * 60,
        });

        return response;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Google OAuth init failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
