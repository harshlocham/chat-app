import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/Db/db";
import { User } from "@/models/User";
import {
    getInternalSecret,
    hasValidInternalSecret,
    INTERNAL_SECRET_HEADER,
} from "@chat/types/utils/internal-bridge-auth";

type AuthorizeIdentityBody = {
    userId?: string;
};

function deny(reason: string, status = 403) {
    return NextResponse.json({ allowed: false, reason }, { status });
}

export async function POST(req: Request) {
    const providedSecret = req.headers.get(INTERNAL_SECRET_HEADER);
    if (!hasValidInternalSecret(providedSecret, getInternalSecret())) {
        return deny("unauthorized_internal_request", 401);
    }

    let body: AuthorizeIdentityBody;
    try {
        body = (await req.json()) as AuthorizeIdentityBody;
    } catch {
        return deny("invalid_json", 400);
    }

    const { userId } = body;
    if (!userId) {
        return deny("invalid_payload", 400);
    }

    await connectToDatabase();

    const user = await User.findById(userId)
        .select("_id role status")
        .lean<{ role?: "user" | "moderator" | "admin"; status?: string } | null>();

    if (!user) {
        return deny("user_not_found", 403);
    }

    if (user.status && user.status !== "active") {
        return deny("user_not_active", 403);
    }

    return NextResponse.json({
        allowed: true,
        role: user.role || "user",
    });
}
