import { NextResponse } from "next/server";
import { AuthUser, getAuthUser } from "@/lib/utils/auth/getAuthUser";

type AdminGuardResult =
    | { user: AuthUser; response: null }
    | { user: null; response: NextResponse };

export async function requireAdminUser(): Promise<AdminGuardResult> {
    const authUser = await getAuthUser();

    if (!authUser) {
        return {
            user: null,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
    }

    if (authUser.role !== "admin") {
        return {
            user: null,
            response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        };
    }

    return {
        user: authUser,
        response: null,
    };
}
