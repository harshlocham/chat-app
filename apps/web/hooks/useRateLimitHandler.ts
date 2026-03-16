"use client";
import { useState } from "react";
import { toast } from "sonner";

export function useRateLimitHandler(lockTime = 5000) {
    const [isRateLimited, setIsRateLimited] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);

    function triggerRateLimit() {
        toast.warning("You’re sending messages too fast. Please wait a moment.");
        setIsRateLimited(true);
        setTimeLeft(lockTime / 1000);

        const interval = setInterval(() => {
            setTimeLeft((t) => {
                if (t <= 1) {
                    clearInterval(interval);
                    setIsRateLimited(false);
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
    }

    return { isRateLimited, timeLeft, triggerRateLimit };
}