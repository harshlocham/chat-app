"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, RefreshCcw } from "lucide-react";
import toast from "react-hot-toast";

export default function RegisterPage() {
    const [step, setStep] = useState<"register" | "verify">("register");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(0);

    const router = useRouter();

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (timer > 0) {
            interval = setInterval(() => setTimer((t) => t - 1), 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [timer]);

    async function sendOtp() {
        setLoading(true);
        const res = await fetch("/api/auth/sendOtp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });

        if (res.ok) {
            setStep("verify");
            setTimer(60);
            toast.success("OTP sent to your email");
        } else {
            toast.error("Failed to send OTP");
        }
        setLoading(false);
    }

    async function handleRegister() {
        if (!name || !email || !password) return;
        await sendOtp();
    }

    async function handleVerify() {
        setLoading(true);
        const res = await fetch("/api/auth/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp, name, password }),
        });

        if (res.ok) {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.ok) {
                toast.success("Welcome 🎉");
                router.push("/");
            }
        } else {
            const data = await res.json();
            toast.error(data.error || "Invalid or expired OTP");
        }
        setLoading(false);
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
            <Card className="w-full max-w-md shadow-lg rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <CardHeader>
                    <CardTitle className="text-center text-2xl font-semibold text-[hsl(var(--foreground))]">
                        {step === "register" ? "Create your account" : "Verify your email 📩"}
                    </CardTitle>
                </CardHeader>

                <CardContent>
                    <AnimatePresence mode="wait">
                        {step === "register" ? (
                            <motion.div
                                key="register"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-4"
                            >
                                <Input
                                    placeholder="Full Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="border-[hsl(var(--input))] focus:ring-[hsl(var(--ring))]"
                                />
                                <Input
                                    type="email"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="border-[hsl(var(--input))] focus:ring-[hsl(var(--ring))]"
                                />
                                <Input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="border-[hsl(var(--input))] focus:ring-[hsl(var(--ring))]"
                                />
                                <Button
                                    className="w-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90"
                                    onClick={handleRegister}
                                    disabled={loading || !email || !password || !name}
                                >
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Create Account
                                </Button>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="verify"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-4 text-center"
                            >
                                <p className="text-[hsl(var(--muted-foreground))] text-sm">
                                    We’ve sent a 6-digit code to <strong>{email}</strong>
                                </p>
                                <Input
                                    maxLength={6}
                                    placeholder="Enter OTP"
                                    className="tracking-widest text-center text-lg border-[hsl(var(--input))] focus:ring-[hsl(var(--ring))]"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                />
                                <Button
                                    className="w-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90"
                                    onClick={handleVerify}
                                    disabled={loading || otp.length < 6}
                                >
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Verify & Login
                                </Button>

                                <div className="pt-2 flex justify-center items-center gap-2">
                                    {timer > 0 ? (
                                        <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                            Resend OTP in {timer}s
                                        </span>
                                    ) : (
                                        <button
                                            onClick={sendOtp}
                                            className="flex items-center text-sm text-[hsl(var(--primary))] hover:underline"
                                        >
                                            <RefreshCcw className="mr-1 h-4 w-4" /> Resend OTP
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>
        </div>
    );
}