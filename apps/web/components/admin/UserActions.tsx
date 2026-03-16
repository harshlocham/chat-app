"use client";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toggleBan, changePermission } from "@/lib/utils/api";

type User = {
    _id: string;
    username: string;
    email: string;
    role: "user" | "moderator" | "admin";
    status: "active" | "banned";
};

export function UserActions({ user, onUpdate }: { user: User; onUpdate: (id: string, updates: Partial<User>) => void }) {
    const toggleban = async () => {
        const userStatus = user.status === "active" ? "banned" : "active";
        await toggleBan(String(user._id), userStatus);

        onUpdate(user._id, { status: userStatus });
    };

    const changeRole = (role: User["role"]) => {
        changePermission(String(user._id), role);
        onUpdate(user._id, { role });
    };
    return (
        <div className="flex gap-2">
            <Button size="sm" variant={user.status === "active" ? "destructive" : "default"} onClick={toggleban}>
                {user.status === "active" ? "Ban" : "Unban"}
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">Role</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-[hsl(var(--card))]">
                    <DropdownMenuItem onClick={() => changeRole("user")}>User</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeRole("moderator")}>Moderator</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeRole("admin")}>Admin</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}