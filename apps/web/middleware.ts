import { jwtVerify, type JWTPayload } from "jose";
import { NextRequest, NextResponse } from "next/server";

type AccessPayload = JWTPayload & {
    sub?: string;
    role?: "user" | "moderator" | "admin";
    type?: "access";
};

async function verifyAccessToken(req: NextRequest): Promise<AccessPayload | null> {
    const token = req.cookies.get("accessToken")?.value;
    const secret = process.env.ACCESS_TOKEN_SECRET;

    if (!token || !secret) {
        return null;
    }

    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
        const accessPayload = payload as AccessPayload;

        if (accessPayload.type !== "access" || !accessPayload.sub) {
            return null;
        }

        return accessPayload;
    } catch {
        return null;
    }
}

export default async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const token = await verifyAccessToken(req);

    const isPublic = pathname === "/login" || pathname === "/register" || pathname === "/error";

    if (isPublic) {
        if (token && (pathname === "/login" || pathname === "/register")) {
            return NextResponse.redirect(new URL("/", req.url));
        }

        return NextResponse.next();
    }

    if (!token) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    if (pathname.startsWith("/admin") && token.role !== "admin") {
        return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /**
         * Pages ONLY — never APIs
         */
        "/login",
        "/register",
        "/",
        "/dashboard/:path*",
        "/profile/:path*",
        "/settings/:path*",
        "/admin/:path*",
    ],
};