import { AuthenticatedUser, validateAuthUser } from "@/lib/utils/auth/validateAuthUser";
import { isAuthError } from "@/lib/utils/auth/authErrors";

export type AuthUser = AuthenticatedUser;

export async function getAuthUser(): Promise<AuthUser | null> {
    try {
        return await validateAuthUser({ useRedisCache: true });
    } catch (error) {
        if (isAuthError(error)) {
            return null;
        }

        throw error;
    }
}
