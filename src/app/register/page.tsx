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

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            toast.error("Passwords do not match")
            return
        }
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
                        <Button variant="link">Sign Up</Button>
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
                        <Button type="submit" className="w-full mt-2 hover:bg-gray-600 transition-colors-2s" variant="outline">
                            Login
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex-col gap-2">

                    <Button variant="outline" className="w-full" onClick={() => signIn("google", { callbackUrl: "/" })}>
                        Singin with Google
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}




export default Loginpage