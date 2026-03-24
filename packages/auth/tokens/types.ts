export type AccessTokenPayload = {
  sub: string; // userId
  role?: "user" | "moderator" | "admin";
  tokenVersion: number;
  type: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  sessionId: string;
  tokenVersion: number;
  type: "refresh";
};