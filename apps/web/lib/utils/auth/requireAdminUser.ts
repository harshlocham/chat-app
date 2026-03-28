import { NextResponse } from "next/server";
import { AuthUser, getAuthUser } from "@/lib/utils/auth/getAuthUser";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/utils/auth/authResponses";

type AdminGuardResult =
    | { user: AuthUser; response: null }
    | { user: null; response: NextResponse };

export async function requireAdminUser(): Promise<AdminGuardResult> {
    const authUser = await getAuthUser();

    if (!authUser) {
        return {
            user: null,
            response: unauthorizedResponse(),
        };
    }

    if (authUser.role !== "admin") {
        return {
            user: null,
            response: forbiddenResponse(),
        };
    }

    return {
        user: authUser,
        response: null,
    };
}
