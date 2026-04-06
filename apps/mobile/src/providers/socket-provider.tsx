import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { Socket } from "socket.io-client";

import { useAuthStore } from "@/features/auth/store/authStore";
import { socketClient } from "@/lib/socket";

type SocketContextValue = {
    socket: Socket | null;
    connected: boolean;
    connecting: boolean;
    connect: () => Promise<Socket | null>;
    disconnect: () => void;
    emit: typeof socketClient.emit;
    on: typeof socketClient.on;
    off: typeof socketClient.off;
};

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
    const user = useAuthStore((state) => state.user);
    const socketRef = useRef<Socket | null>(null);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);

    useEffect(() => {
        const currentSocket = socketClient.getSocket();
        socketRef.current = currentSocket;
        setSocket(currentSocket);

        const handleConnect = () => {
            setConnected(true);
            setConnecting(false);
        };

        const handleDisconnect = () => {
            setConnected(false);
            setConnecting(false);
        };

        const handleConnectError = () => {
            setConnecting(false);
        };

        currentSocket.on("connect", handleConnect);
        currentSocket.on("disconnect", handleDisconnect);
        currentSocket.on("connect_error", handleConnectError);

        const subscription = AppState.addEventListener("change", (nextState) => {
            appStateRef.current = nextState;

            if (nextState !== "active") {
                socketClient.disconnect();
                return;
            }

            if (useAuthStore.getState().user) {
                setConnecting(true);
                void socketClient.connect().finally(() => {
                    setConnecting(false);
                });
            }
        });

        return () => {
            subscription.remove();
            currentSocket.off("connect", handleConnect);
            currentSocket.off("disconnect", handleDisconnect);
            currentSocket.off("connect_error", handleConnectError);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const syncSocket = async () => {
            if (!user) {
                socketClient.disconnect();
                if (!cancelled) {
                    setConnected(false);
                    setConnecting(false);
                }

                return;
            }

            if (appStateRef.current !== "active") {
                return;
            }

            setConnecting(true);

            try {
                await socketClient.connect();
                if (!cancelled) {
                    setConnected(Boolean(socketRef.current?.connected));
                }
            } finally {
                if (!cancelled) {
                    setConnecting(false);
                }
            }
        };

        void syncSocket();

        return () => {
            cancelled = true;
        };
    }, [user]);

    const value = useMemo<SocketContextValue>(
        () => ({
            socket,
            connected,
            connecting,
            connect: socketClient.connect.bind(socketClient),
            disconnect: socketClient.disconnect.bind(socketClient),
            emit: socketClient.emit.bind(socketClient),
            on: socketClient.on.bind(socketClient),
            off: socketClient.off.bind(socketClient),
        }),
        [connected, connecting, socket]
    );

    return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
    const context = useContext(SocketContext);

    if (!context) {
        throw new Error("useSocket must be used within SocketProvider");
    }

    return context;
}