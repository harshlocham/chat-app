import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/Db/db";
import {
    buildAccessTokenCookie,
    buildRefreshTokenCookie,
    createUserSession,
    generateAccessToken,
    registerService,
} from "@chat/auth";

function safeIpAddress(req: NextRequest): string {
    const xForwardedFor = req.headers.get("x-forwarded-for") || "";
    return xForwardedFor.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const username = String(body?.username || body?.name || "").trim();
        const email = String(body?.email || "").trim();
        const password = String(body?.password || "");

        if (!username || !email || !password) {
            return NextResponse.json(
                { success: false, error: "Username, email and password are required" },
                { status: 400 }
            );
        }

        await connectToDatabase();

        const user = await registerService({
            username,
            email,
            password,
        });

        const accessToken = generateAccessToken({
            sub: user._id.toString(),
            role: user.role,
            type: "access",
        });

        const { refreshToken } = await createUserSession({
            userId: user._id.toString(),
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
            const status = error.message === "User already exists" ? 409 : 400;
            return NextResponse.json({ success: false, error: error.message }, { status });
        }

        return NextResponse.json({ success: false, error: "Registration failed" }, { status: 500 });
    }
}
