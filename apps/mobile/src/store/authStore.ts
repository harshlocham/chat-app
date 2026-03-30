import { create } from "zustand";
import type { AuthUser } from "../types/auth";
import { loginWithPassword, logoutFromCurrentDevice } from "../lib/auth/authService";
import { getAccessToken } from "../lib/auth/tokenStore";

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,
  error: null,

  bootstrap: async () => {
    try {
      const token = await getAccessToken();
      set({
        isAuthenticated: Boolean(token),
        isBootstrapping: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to restore session";
      set({
        error: message,
        isAuthenticated: false,
        user: null,
        isBootstrapping: false,
      });
    }
  },

  login: async (email: string, password: string) => {
    set({ error: null });
    try {
      const user = await loginWithPassword(email, password);
      set({
        user,
        isAuthenticated: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      set({
        user: null,
        isAuthenticated: false,
        error: message,
      });
      throw error;
    }
  },

  logout: async () => {
    await logoutFromCurrentDevice();
    set({
      user: null,
      isAuthenticated: false,
    });
  },

  clearError: () => set({ error: null }),
}));
