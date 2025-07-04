'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from "@/components/ui/button"
import ThemeSwitch from "@/components/home/theme-switch";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"

function Loginpage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });
        if (result?.error) {
            console.error(result.error);
        } else {
            console.log("Login successfuly");
            router.push("/");
        }
    }
    return (
        <div className='flex justify-center items-center min-h-screen'>
            <Card className="w-full max-w-sm ">
                <CardHeader>
                    <CardTitle>Login to your account</CardTitle>
                    <CardDescription>
                        Enter your email below to login to your account
                    </CardDescription>
                    <CardAction>
                        <Button variant="link">Sign Up</Button>
                        <ThemeSwitch />
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} >
                        <div className="flex flex-col gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="m@example.com"
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">Password</Label>
                                    <a
                                        href="#"
                                        className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                                    >
                                        Forgot your password?
                                    </a>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button type="submit" className="w-full mt-2 hover:bg-gray-600 transition-colors-2s" variant="outline">
                            Login
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex-col gap-2">

                    <Button variant="outline" className="w-full" onClick={() => signIn("google", { callbackUrl: "/" })}>
                        Login with Google
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
export default Loginpage;