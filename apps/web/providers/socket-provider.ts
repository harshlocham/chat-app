'use client';

import { useEffect } from "react";
import { socket, registerGlobalSocketListeners } from "@/lib/socket/socketClient";
import { useUser } from "@/context/UserContext";
import { useSocketPresence } from "@/lib/hooks/useSocketPresence";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";

const isTabVisible = () =>
    typeof document === "undefined" || document.visibilityState === "visible";

export function SocketProvider({ children }: { children: React.ReactNode }) {
    const { user } = useUser();
    const isOnline = useNetworkStatus();
    useSocketPresence(user?._id ?? null);

    useEffect(() => {
        if (!user?._id) return;

        socket.auth = { userId: user._id };
        socket.connect();

        registerGlobalSocketListeners();

        return () => {
            socket.disconnect();
        };
    }, [user?._id]);

    useEffect(() => {
        if (!user?._id) return;

        const ensureConnected = () => {
            if (!isOnline) return;
            if (!isTabVisible()) return;
            if (!socket.connected) {
                socket.connect();
            }
        };

        const handleDisconnect = (reason: string) => {
            if (reason === "io server disconnect") {
                setTimeout(ensureConnected, 1200);
            }
        };

        const handleConnectError = () => {
            setTimeout(ensureConnected, 1500);
        };

        if (isOnline) {
            ensureConnected();
        }

        const reconnectInterval = setInterval(() => {
            ensureConnected();
        }, 5000);

        socket.on("disconnect", handleDisconnect);
        socket.on("connect_error", handleConnectError);

        return () => {
            clearInterval(reconnectInterval);
            socket.off("disconnect", handleDisconnect);
            socket.off("connect_error", handleConnectError);
        };
    }, [user?._id, isOnline]);

    useEffect(() => {
        if (!user?._id) return;

        const disconnectNow = () => {
            if (socket.connected) {
                socket.disconnect();
            }
        };

        const reconnectNow = () => {
            if (!isOnline) return;
            if (!socket.connected) {
                socket.connect();
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                disconnectNow();
                return;
            }
            reconnectNow();
        };

        const handlePageHide = () => {
            disconnectNow();
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("pagehide", handlePageHide);
        window.addEventListener("beforeunload", handlePageHide);

        handleVisibilityChange();

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("pagehide", handlePageHide);
            window.removeEventListener("beforeunload", handlePageHide);
        };
    }, [user?._id, isOnline]);

    return children;
}