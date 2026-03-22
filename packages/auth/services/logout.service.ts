import { verifyRefreshToken } from "../tokens/verify";
import { deleteSession, deleteUserSessions } from "../repositories/session.repo";

export const logoutService = async ({
    refreshToken,
    logoutFromAllDevices = false,
}: {
    refreshToken: string;
    logoutFromAllDevices?: boolean;
}) => {
    const payload = verifyRefreshToken(refreshToken);

    if (logoutFromAllDevices) {
        await deleteUserSessions(payload.sub);
        return { allDevices: true };
    }

    await deleteSession(payload.sessionId);
    return { allDevices: false };
};
