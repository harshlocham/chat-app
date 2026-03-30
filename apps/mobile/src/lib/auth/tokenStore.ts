import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "chat.accessToken";
const REFRESH_TOKEN_KEY = "chat.refreshToken";
const DEVICE_ID_KEY = "chat.deviceId";

function generateDeviceId(): string {
  const appId = Application.applicationId || "chat-mobile";
  const rand = Math.random().toString(36).slice(2);
  return `${appId}-${Date.now()}-${rand}`;
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const created = generateDeviceId();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created);
  return created;
}
