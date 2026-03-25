import { NextRequest, NextResponse } from "next/server";
import { authRefreshRateLimiter } from "@/lib/utils/rateLimiter";
import {
    AuthStepUpRequiredError,
    authConfig,
    buildAccessTokenCookie,
    buildRefreshTokenCookie,
    logAuthEventBestEffort,
    refreshService,
} from "@chat/auth";

type RequestContext = {
    ipAddress: string;
    userAgent?: string;
};

function getRequestContext(req: NextRequest): RequestContext {
    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const ipAddress =
        forwardedFor
            .split(",")
            .map((entry) => entry.trim())
            .find(Boolean) || "unknown";
    const userAgent = req.headers.get("user-agent") || undefined;

    return { ipAddress, userAgent };
}

async function logRefreshFailure(
    context: RequestContext,
    reason: string,
    metadata?: Record<string, unknown>
) {
    await logAuthEventBestEffort({
        eventType: "refresh_failed",
        outcome: "failure",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        reason,
        metadata,
    });
}

function getCookieRefreshToken(req: NextRequest): string {
    return req.cookies.get(authConfig.cookie.refreshToken)?.value || "";
}

async function getBodyRefreshToken(req: NextRequest): Promise<string> {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        return "";
    }

    try {
        const body = (await req.json()) as unknown;
        if (!body || typeof body !== "object") {
            return "";
        }

        const payload = body as { refreshToken?: unknown };
        if (typeof payload.refreshToken !== "string") {
            return "";
        }

        return payload.refreshToken.trim();
    } catch {
        return "";
    }
}

export async function POST(req: NextRequest) {
    const context = getRequestContext(req);

    try {
        const { success } = await authRefreshRateLimiter.limit(context.ipAddress);
        if (!success) {
            await logRefreshFailure(context, "rate_limited");
            return NextResponse.json(
                { success: false, error: "Too many refresh attempts. Try again later." },
                { status: 429 }
            );
        }

        const bodyRefreshToken = await getBodyRefreshToken(req);
        const cookieRefreshToken = getCookieRefreshToken(req);
        const refreshToken = bodyRefreshToken || cookieRefreshToken;

        if (!refreshToken) {
            await logRefreshFailure(context, "missing_refresh_token");
            return NextResponse.json({ success: false, error: "Refresh token is required" }, { status: 401 });
        }

        const tokens = await refreshService({
            refreshToken,
            userAgent: context.userAgent,
            ipAddress: context.ipAddress,
        });

        await logAuthEventBestEffort({
            eventType: "refresh_success",
            outcome: "success",
            userId: tokens.userId,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            metadata: { sessionId: tokens.sessionId },
        });

        const response = NextResponse.json({ success: true });
        response.headers.append("Set-Cookie", buildAccessTokenCookie(tokens.accessToken));
        response.headers.append("Set-Cookie", buildRefreshTokenCookie(tokens.refreshToken));

        return response;
    } catch (error) {
        if (error instanceof AuthStepUpRequiredError) {
            await logAuthEventBestEffort({
                eventType: "step_up_triggered",
                outcome: "success",
                userId: error.userId,
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                reason: error.code,
                metadata: {
                    reasons: error.reasons,
                    challengeId: error.challengeId,
                },
            });

            const response = NextResponse.json(
                {
                    success: false,
                    error: "STEP_UP_REQUIRED",
                    challengeId: error.challengeId,
                },
                { status: error.status }
            );
            return response;
        }

        if (error instanceof Error) {
            await logRefreshFailure(context, error.message);
            return NextResponse.json({ success: false, error: "Refresh failed" }, { status: 401 });
        }

        await logRefreshFailure(context, "unknown_error");
        return NextResponse.json({ success: false, error: "Refresh failed" }, { status: 500 });
    }
}
