import { NextResponse } from "next/server";
import { AuthUser, getAuthUser } from "@/lib/utils/auth/getAuthUser";
import { unauthorizedResponse } from "@/lib/utils/auth/authResponses";

type AuthGuardResult =
    | { user: AuthUser; response: null }
    | { user: null; response: NextResponse };

export async function requireAuthUser(): Promise<AuthGuardResult> {
    const authUser = await getAuthUser();

    if (!authUser) {
        return {
            user: null,
            response: unauthorizedResponse(),
        };
    }

    return {
        user: authUser,
        response: null,
    };
}
