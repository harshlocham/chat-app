import api from "../api/client";
import { tokenStore } from "./tokenStore";

export async function login(email: string, password: string) {
    const deviceId = await tokenStore.getOrCreateDeviceId();
    const res = await api.post(
        "/auth/login",
        { email: email.trim(), password, deviceId },
        {
            headers: {
                "x-device-id": deviceId,
            },
        }
    );

    const { accessToken, refreshToken, user } = res.data;

    await tokenStore.setTokens(accessToken, refreshToken);

    return user;
}

export async function logout() {
    try {
        const refreshToken = await tokenStore.getRefreshToken();
        const deviceId = await tokenStore.getOrCreateDeviceId();

        if (refreshToken) {
            await api.post(
                "/auth/logout",
                {
                    refreshToken,
                    logoutFromAllDevices: false,
                },
                {
                    headers: {
                        "x-device-id": deviceId,
                    },
                }
            );
        }
    } catch (e) {
        console.log("Logout API failed (safe to ignore)", e);
    } finally {
        await tokenStore.clearTokens();
    }
}