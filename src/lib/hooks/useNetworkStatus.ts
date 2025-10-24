'use client';
import { useEffect, useState } from "react";

export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        if (typeof navigator !== 'undefined') {
            setIsOnline(navigator.onLine);
        }
    }, []);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);
    return isOnline;
}