import { NextResponse } from "next/server";
import { AuthError } from "@/lib/utils/auth/authErrors";

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

export function authErrorResponse(error: AuthError) {
    return NextResponse.json(
        {
            success: false,
            error: error.message,
            code: error.code,
        },
        { status: error.statusCode }
    );
}
