import { useEffect, useState } from "react";
import { tokenStore } from "../auth/tokenStore";
import { useAuthStore } from "../store/authStore";
import api from "../api/client";

export function useAuthBootstrap() {
    const [loading, setLoading] = useState(true);
    const setUser = useAuthStore((s) => s.setUser);
    const user = useAuthStore((s) => s.user);

    useEffect(() => {
        (async () => {
            try {
                const token = await tokenStore.getAccessToken();

                if (token) {
                    //  real validation
                    const res = await api.get("/me");
                    setUser(res.data);
                }
            } catch (e) {
                console.log("Bootstrap failed", e);
                await tokenStore.clearTokens();
                setUser(null);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return {
        loading,
        isAuthenticated: !!user,
    };
}