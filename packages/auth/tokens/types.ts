export type AccessTokenPayload = {
  sub: string; // userId
  type: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  sessionId: string;
  type: "refresh";
};