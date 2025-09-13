// src/app/admin/page.tsx
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Charts } from "@/components/admin/Charts";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useSession } from "next-auth/react";

export default function AdminDashboard() {
    const [stats, setStats] = useState({ activeUsers: 0, totalMessagesToday: 0 });
    const { data: session } = useSession();
    useEffect(() => {
        const socket = io("http://localhost:3001", {
            transports: ["websocket"], // avoid polling issues
            auth: {
                userId: session?.user?.email,
                isAdmin: true
            }, // required by your server
        });

        socket.on("connect", () => {
            console.log("✅ Connected to socket:", socket.id);
            socket.emit("admin:join");
        });

        socket.on("connect_error", (err) => {
            console.error("❌ Connection failed:", err.message);
        });

        socket.on("dashboard:init", (data) => {
            setStats(data);
            console.log("📊 Initial stats:", data);
        });

        socket.on("dashboard:update", (data) => {
            setStats((prev) => ({ ...prev, ...data }));
            console.log("📈 Update received:", data);
        });

        return () => {
            socket.disconnect();
        };
    }, [session]);
    console.log(stats);
    return (
        <div className="space-y-6 bg-[hsl(var(--gray-primary)]">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[hsl(var(--gray-primary)]">
                <Card>
                    <CardHeader>
                        <CardTitle>Active Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{stats.activeUsers}</p>
                        <p className="text-sm text-muted-foreground">+5% from last week</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Messages Today</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{stats.totalMessagesToday}</p>
                        <p className="text-sm text-muted-foreground">+12% from yesterday</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Open Reports</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">23</p>
                        <p className="text-sm text-muted-foreground">Need review</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <Charts />
        </div>
    );
}