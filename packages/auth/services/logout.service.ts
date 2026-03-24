import { verifySession } from "../session/verify-session";
import { deleteSession, deleteUserSessions } from "../repositories/session.repo";

export const logoutService = async ({
    refreshToken,
    logoutFromAllDevices = false,
}: {
    refreshToken: string;
    logoutFromAllDevices?: boolean;
}) => {
    const { payload } = await verifySession(refreshToken);

    if (logoutFromAllDevices) {
        await deleteUserSessions(payload.sub);
        return {
            allDevices: true,
            userId: payload.sub,
            sessionId: payload.sessionId,
        };
    }

    await deleteSession(payload.sessionId);
    return {
        allDevices: false,
        userId: payload.sub,
        sessionId: payload.sessionId,
    };
};
