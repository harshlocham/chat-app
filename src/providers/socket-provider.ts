'use client';

import { useEffect } from "react";
import { socket, registerGlobalSocketListeners } from "@/lib/socket/socketClient";
import { useUser } from "@/context/UserContext";

/**
 * Manages a user-authenticated socket connection for the React tree and renders its children.
 *
 * When a user ID becomes available, it configures and opens the socket connection and registers global socket listeners; the connection is closed when the component unmounts or the user ID changes.
 *
 * @param children - The React nodes to render within this provider.
 * @returns The `children` prop, rendered as-is.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
    const { user } = useUser();

    useEffect(() => {
        if (!user?._id) return;

        socket.auth = { userId: user._id };
        socket.connect();

        registerGlobalSocketListeners();

        return () => {
            socket.disconnect();
        };
    }, [user?._id]);

    return children;
}