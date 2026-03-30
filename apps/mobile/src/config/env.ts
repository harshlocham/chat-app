const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const SOCKET_BASE_URL = process.env.EXPO_PUBLIC_SOCKET_URL;

export function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured");
  }
  return API_BASE_URL;
}

export function getSocketBaseUrl(): string {
  if (!SOCKET_BASE_URL) {
    throw new Error("EXPO_PUBLIC_SOCKET_URL is not configured");
  }
  return SOCKET_BASE_URL;
}
