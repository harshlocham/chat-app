import { NextResponse } from "next/server";
import { AuthUser, getAuthUser } from "@/lib/utils/auth/getAuthUser";

type AuthGuardResult =
    | { user: AuthUser; response: null }
    | { user: null; response: NextResponse };

export async function requireAuthUser(): Promise<AuthGuardResult> {
    const authUser = await getAuthUser();

    if (!authUser) {
        return {
            user: null,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
    }

    return {
        user: authUser,
        response: null,
    };
}
