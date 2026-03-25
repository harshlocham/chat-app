"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ChallengeFormProps = {
    challengeId: string;
    nextPath: string;
};

type ChallengeResponse = {
    success?: boolean;
    error?: string;
    reason?: string;
};

export default function ChallengeForm({ challengeId, nextPath }: ChallengeFormProps) {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSubmit = useMemo(
        () => Boolean(challengeId) && password.trim().length > 0 && !loading,
        [challengeId, password, loading]
    );

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!challengeId) {
            setError("Challenge is missing. Please refresh and try again.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/auth/challenge/password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    challengeId,
                    password,
                }),
            });

            const payload = (await response.json().catch(() => null)) as ChallengeResponse | null;
            if (!response.ok || !payload?.success) {
                setError(payload?.reason || payload?.error || "Verification failed. Please try again.");
                return;
            }

            router.replace(nextPath || "/dashboard");
        } catch {
            setError("Unable to verify right now. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
                <label className="text-sm font-medium text-[hsl(var(--foreground))]" htmlFor="step-up-password">
                    Password
                </label>
                <Input
                    id="step-up-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={loading}
                    required
                />
            </div>

            {error ? (
                <p className="text-sm text-red-600" role="alert">
                    {error}
                </p>
            ) : null}

            <Button className="w-full" type="submit" disabled={!canSubmit}>
                {loading ? "Verifying..." : "Verify"}
            </Button>
        </form>
    );
}
