// src/components/admin/UserTable.tsx
"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserActions } from "./UserActions";
import { getUsers } from "@/lib/utils/api";

type User = {
    _id: string;
    username: string;
    email: string;
    role: "user" | "moderator" | "admin";
    status: "active" | "banned";
};

export function UserTable() {
    const [search, setSearch] = useState("");
    const [users, setUsers] = useState<User[]>([]);
    useEffect(() => {
        getUsers().then(setUsers)
    }, [])
    const filteredUsers = users.filter(
        (u) =>
            u.username.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase())
    );

    // Update user state after action
    const updateUser = (id: string, updates: Partial<User>) => {
        setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, ...updates } : u)));
    };

    return (
        <Card className="p-4">
            <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-4"
            />
            <CardContent className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="text-left border-b">
                            <th className="p-2">Name</th>
                            <th className="p-2">Email</th>
                            <th className="p-2">Role</th>
                            <th className="p-2">Status</th>
                            <th className="p-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map((user) => (
                            <tr key={user._id} className="border-b hover:bg-[hsl(var(--gray-secondary))]">
                                <td className="p-2">{user.username}</td>
                                <td className="p-2">{user.email}</td>
                                <td className="p-2 capitalize">{user.role}</td>
                                <td className="p-2">
                                    <span
                                        className={`px-2 py-1 rounded text-xs ${user.status === "active"
                                            ? "bg-green-100 text-green-700"
                                            : "bg-red-100 text-red-700"
                                            }`}
                                    >
                                        {user.status}
                                    </span>
                                </td>
                                <td className="p-2">
                                    <UserActions user={user} onUpdate={updateUser} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </CardContent>
        </Card>
    );
}