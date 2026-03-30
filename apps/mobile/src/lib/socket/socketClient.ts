import { io, type Socket } from "socket.io-client";
import { getSocketBaseUrl } from "../../config/env";
import { getAccessToken } from "../auth/tokenStore";

let socketInstance: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("Cannot connect socket without access token");
  }

  if (socketInstance?.connected) {
    return socketInstance;
  }

  socketInstance = io(getSocketBaseUrl(), {
    path: "/api/socket",
    transports: ["websocket", "polling"],
    reconnection: true,
    withCredentials: true,
    auth: {
      accessToken,
    },
    extraHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return socketInstance;
}

export async function reconnectSocketWithLatestToken(): Promise<Socket> {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
  return connectSocket();
}

export function getSocket(): Socket {
  if (!socketInstance) {
    throw new Error("Socket has not been initialized");
  }
  return socketInstance;
}

export function disconnectSocket(): void {
  if (!socketInstance) {
    return;
  }
  socketInstance.disconnect();
  socketInstance = null;
}
