import axios from "axios";
import { getApiBaseUrl } from "../../config/env";
import type { LoginResponse, RefreshResponse } from "../../types/auth";
import {
  clearTokens,
  getOrCreateDeviceId,
  getRefreshToken,
  saveTokens,
} from "./tokenStore";

export async function loginWithPassword(email: string, password: string) {
  const deviceId = await getOrCreateDeviceId();

  const response = await axios.post<LoginResponse>(
    `${getApiBaseUrl()}/api/auth/login`,
    {
      email,
      password,
      deviceId,
    },
    {
      headers: {
        "x-device-id": deviceId,
      },
    }
  );

  await saveTokens(response.data.accessToken, response.data.refreshToken);
  return response.data.user;
}

export async function refreshSessionTokens(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new Error("Refresh token is missing");
  }

  const deviceId = await getOrCreateDeviceId();
  const response = await axios.post<RefreshResponse>(
    `${getApiBaseUrl()}/api/auth/refresh`,
    {
      refreshToken,
      deviceId,
    },
    {
      headers: {
        "x-device-id": deviceId,
      },
    }
  );

  await saveTokens(response.data.accessToken, response.data.refreshToken);
  return response.data.accessToken;
}

export async function logoutFromCurrentDevice(): Promise<void> {
  const refreshToken = await getRefreshToken();

  try {
    if (refreshToken) {
      await axios.post(
        `${getApiBaseUrl()}/api/auth/logout`,
        {
          refreshToken,
          logoutFromAllDevices: false,
        }
      );
    }
  } finally {
    await clearTokens();
  }
}
