import { NextResponse } from "next/server";

export function unauthorizedResponse() {
    return NextResponse.json(
        {
            success: false,
            error: "Unauthorized",
            code: "AUTH_UNAUTHORIZED",
        },
        { status: 401 }
    );
}

export function forbiddenResponse() {
    return NextResponse.json(
        {
            success: false,
            error: "Forbidden",
            code: "AUTH_FORBIDDEN",
        },
        { status: 403 }
    );
}
