export type AccessTokenPayload = {
  sub: string; // userId
  role?: "user" | "moderator" | "admin";
  type: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  sessionId: string;
  type: "refresh";
};