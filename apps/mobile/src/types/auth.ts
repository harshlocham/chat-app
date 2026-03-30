export type AuthRole = "user" | "moderator" | "admin";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: AuthRole;
  status: string;
  profilePicture: string | null;
};

export type LoginResponse = {
  success: boolean;
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export type RefreshResponse = {
  success: boolean;
  accessToken: string;
  refreshToken: string;
};
