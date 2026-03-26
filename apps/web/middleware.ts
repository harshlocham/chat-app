import { jwtVerify, type JWTPayload } from "jose";
import { NextRequest, NextResponse } from "next/server";

type AccessPayload = JWTPayload & {
    sub?: string;
    role?: "user" | "moderator" | "admin";
    tokenVersion?: number;
    type?: "access";
};

type IdentityAuthzResponse = {
    allowed?: boolean;
    role?: "user" | "moderator" | "admin";
};

type StepUpStatusResponse = {
    requiresStepUp?: boolean;
    challengeId?: string;
};

async function verifyAccessToken(req: NextRequest): Promise<AccessPayload | null> {
    const token = req.cookies.get("accessToken")?.value;
    const secret = process.env.ACCESS_TOKEN_SECRET;

    if (!token || !secret) {
        return null;
    }

    try {
        // SECURITY FIX: Explicitly restrict algorithm to HS256
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
            algorithms: ["HS256"],
        });
        const accessPayload = payload as AccessPayload;

        if (
            accessPayload.type !== "access" ||
            !accessPayload.sub ||
            typeof accessPayload.tokenVersion !== "number" ||
            !Number.isInteger(accessPayload.tokenVersion) ||
            accessPayload.tokenVersion < 0
        ) {
            return null;
        }

        return accessPayload;
    } catch {
        return null;
    }
}

async function hasActiveAdminRole(
    req: NextRequest,
    userId: string,
    tokenVersion?: number
): Promise<boolean> {
    const internalSecret = process.env.INTERNAL_SECRET;
    if (!internalSecret) {
        return false;
    }

    try {
        const response = await fetch(
            `${req.nextUrl.origin}/api/internal/socket/authorize-identity`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-internal-secret": internalSecret,
                },
                body: JSON.stringify({ userId, tokenVersion }),
                cache: "no-store",
            }
        );

        if (!response.ok) {
            return false;
        }

        const data = (await response.json()) as IdentityAuthzResponse;
        return data.allowed === true && data.role === "admin";
    } catch {
        return false;
    }
}

async function getPendingStepUpChallengeId(
    req: NextRequest,
    userId: string
): Promise<string | null> {
    const internalSecret = process.env.INTERNAL_SECRET;
    if (!internalSecret) {
        return null;
    }

    try {
        const response = await fetch(
            `${req.nextUrl.origin}/api/internal/auth/step-up-status`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-internal-secret": internalSecret,
                },
                body: JSON.stringify({ userId }),
                cache: "no-store",
            }
        );

        if (!response.ok) {
            return null;
        }

        const data = (await response.json()) as StepUpStatusResponse;
        if (data.requiresStepUp && typeof data.challengeId === "string" && data.challengeId) {
            return data.challengeId;
        }

        return null;
    } catch {
        return null;
    }
}

export default async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const token = await verifyAccessToken(req);
    const hasRefreshToken = Boolean(req.cookies.get("refreshToken")?.value);

    const isPublic =
        pathname === "/login" ||
        pathname === "/register" ||
        pathname === "/error" ||
        pathname.startsWith("/auth/challenge");

    if (isPublic) {
        if (token && (pathname === "/login" || pathname === "/register")) {
            return NextResponse.redirect(new URL("/", req.url));
        }

        return NextResponse.next();
    }

    if (!token && !hasRefreshToken) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    if (!token) {
        return NextResponse.next();
    }

    if (token.sub) {
        const challengeId = await getPendingStepUpChallengeId(req, token.sub);
        if (challengeId) {
            const redirectUrl = new URL("/auth/challenge", req.url);
            redirectUrl.searchParams.set("cid", challengeId);
            const nextPath = `${pathname}${req.nextUrl.search || ""}`;
            redirectUrl.searchParams.set("next", nextPath);
            return NextResponse.redirect(redirectUrl);
        }
    }

    if (pathname.startsWith("/admin")) {
        if (!token.sub) {
            return NextResponse.redirect(new URL("/", req.url));
        }

        const isAdmin = await hasActiveAdminRole(req, token.sub, token.tokenVersion);
        if (!isAdmin) {
            return NextResponse.redirect(new URL("/", req.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /**
         * Pages ONLY - never APIs
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
