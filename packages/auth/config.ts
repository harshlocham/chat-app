export const authConfig = {
  accessToken: {
    secret: process.env.ACCESS_TOKEN_SECRET!,
    expiresIn: "15m",
  },
  refreshToken: {
    secret: process.env.REFRESH_TOKEN_SECRET!,
    expiresIn: "7d",
  },
  cookie: {
    accessToken: "accessToken",
    refreshToken: "refreshToken",
  },
};