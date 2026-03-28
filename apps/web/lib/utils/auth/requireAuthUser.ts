import { NextResponse } from "next/server";
import { AuthUser } from "@/lib/utils/auth/getAuthUser";
import { authErrorResponse } from "@/lib/utils/auth/authResponses";
import { isAuthError } from "@/lib/utils/auth/authErrors";
import { validateAuthUser } from "@/lib/utils/auth/validateAuthUser";

type AuthGuardResult =
    | { user: AuthUser; response: null }
    | { user: null; response: NextResponse };

export async function requireAuthUser(): Promise<AuthGuardResult> {
    try {
        const authUser = await validateAuthUser({ useRedisCache: true });

        return {
            user: authUser,
            response: null,
        };
    } catch (error) {
        if (isAuthError(error)) {
            return {
                user: null,
                response: authErrorResponse(error),
            };
        }

        return {
            user: null,
            response: NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized",
                    code: "AUTH_UNAUTHORIZED",
                },
                { status: 401 }
            ),
        };
    }
}
