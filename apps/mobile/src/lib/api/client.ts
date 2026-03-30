import axios, { AxiosHeaders } from "axios";
import { getApiBaseUrl } from "../../config/env";
import { refreshSessionTokens } from "../auth/authService";
import { getAccessToken } from "../auth/tokenStore";

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 20000,
});

let refreshInFlight: Promise<string> | null = null;

apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config) {
      throw error;
    }

    const originalRequest = error.config as typeof error.config & {
      _retry?: boolean;
    };

    const status = error.response?.status;
    const requestUrl = originalRequest.url || "";
    const isAuthEndpoint =
      requestUrl.includes("/api/auth/login") ||
      requestUrl.includes("/api/auth/refresh") ||
      requestUrl.includes("/api/auth/logout");

    if (status !== 401 || originalRequest._retry || isAuthEndpoint) {
      throw error;
    }

    originalRequest._retry = true;

    if (!refreshInFlight) {
      refreshInFlight = refreshSessionTokens().finally(() => {
        refreshInFlight = null;
      });
    }

    const nextAccessToken = await refreshInFlight;
    const headers =
      originalRequest.headers instanceof AxiosHeaders
        ? originalRequest.headers
        : new AxiosHeaders(originalRequest.headers || {});
    headers.set("Authorization", `Bearer ${nextAccessToken}`);
    originalRequest.headers = headers;

    return apiClient(originalRequest);
  }
);

export { apiClient };
