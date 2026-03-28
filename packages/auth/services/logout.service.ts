import { verifySession } from "../session/verify-session";
import { deleteSession } from "../repositories/session.repo";
import { invalidateAllUserTokens } from "../tokens/invalidate";

export interface LogoutResult {
    allDevices: boolean;
    userId: string;
    sessionId: string;
    tokenVersionBefore?: number;
    tokenVersionAfter?: number;
}

/**
 * Logout a user - either from current device or all devices.
 * 
 * Behavior:
 * - logoutFromAllDevices=false (default): Deletes only the current session.
 *   Token remains valid if used from other devices.
 * - logoutFromAllDevices=true: Deletes all sessions AND increments tokenVersion.
 *   This completely invalidates all tokens across all devices.
 * 
 * Use "logout from all devices" for high-security scenarios:
 * - User suspects account compromise
 * - User is leaving a shared device
 * - User wants to ensure complete logout
 * 
 * @param refreshToken - The refresh token to invalidate
 * @param logoutFromAllDevices - If true, invalidates all sessions and all tokens
 * @returns Logout result with device info and token version update
 */
export const logoutService = async ({
    refreshToken,
    logoutFromAllDevices = false,
}: {
    refreshToken: string;
    logoutFromAllDevices?: boolean;
}): Promise<LogoutResult> => {
    const { payload } = await verifySession(refreshToken);

    if (logoutFromAllDevices) {
        // For logout from all devices, we invalidate ALL tokens + delete all sessions
        const invalidationResult = await invalidateAllUserTokens(
            payload.sub,
            "user_logout_all_devices"
        );

        return {
            allDevices: true,
            userId: payload.sub,
            sessionId: payload.sessionId,
            tokenVersionBefore: invalidationResult.previousTokenVersion,
            tokenVersionAfter: invalidationResult.newTokenVersion,
        };
    }

    // For normal logout, just delete this session
    await deleteSession(payload.sessionId);
    return {
        allDevices: false,
        userId: payload.sub,
        sessionId: payload.sessionId,
    };
};
