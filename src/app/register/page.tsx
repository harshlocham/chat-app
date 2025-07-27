'use client'
import React, { useState } from 'react'
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
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import toast from "react-hot-toast";



function Loginpage() {
    const [username, setUserName] = useState("")
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);


    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            toast.error("Passwords do not match")
            return
        }
        setLoading(true);
        try {
            const res = await fetch('api/auth/register', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    email,
                    password
                })
            })
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Registration failed")
            } else {
                console.log(data)
                toast.success("Registration successfuly")
                router.push("/login");
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false);
        }
    }

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        try {
            await signIn("google", { callbackUrl: "/" });
        } finally {
            setGoogleLoading(false);
        }
    }

    return (
        <div className='flex justify-center items-center min-h-screen'>
            <Card className="w-full max-w-sm ">
                <CardHeader>
                    <CardTitle>Create an account</CardTitle>
                    <CardDescription>

                    </CardDescription>
                    <CardAction>
                        <Button className='cursor-pointer transition duration-200 ease-in-out hover:scale-105' variant="link" onClick={() => router.push('/login')}>Login</Button>
                        <ThemeSwitch />
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} >
                        <div className="flex flex-col gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="usename">Username</Label>
                                <Input
                                    id="usename"
                                    type="text"
                                    placeholder="Enter username"
                                    onChange={(e) => setUserName(e.target.value)}
                                    required
                                />
                            </div>
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
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">Confirm Password</Label>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button type="submit" className=" cursor-pointer w-full mt-2 transition duration-200 ease-in-out hover:bg-gray-600 hover:scale-105 hover:shadow-lg flex items-center justify-center" variant="outline" disabled={loading}>
                            {loading && (
                                <svg className="animate-spin h-5 w-5 mr-2 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                </svg>
                            )}
                            {loading ? 'Registering...' : 'Login'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex-col gap-2">

                    <Button variant="outline" className="w-full cursor-pointer transition duration-200 ease-in-out hover:bg-gray-600 hover:scale-105 flex items-center justify-center" onClick={handleGoogleSignIn} disabled={googleLoading}>
                        {googleLoading && (
                            <svg className="animate-spin h-5 w-5 mr-2 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                            </svg>
                        )}
                        {googleLoading ? 'Signing in...' : 'Singin with Google'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}




export default Loginpage