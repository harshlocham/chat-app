// lib/api.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
//import axios from "axios";

// Client-side call to fetch user info from your API
export async function getMe() {
    const res = await fetch("/api/me");
    if (!res.ok) throw new Error("Failed to fetch current user");
    return await res.json();
}

export async function getUsers() {
    const res = await fetch("/api/users");
    if (!res.ok) throw new Error("Failed to fetch users");
    return await res.json();
}

export async function createConversation(data: any) {
    const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create conversation");
    return await res.json(); // expects: { _id }
}
export async function generateUploadUrl() {
    const res = await fetch("/api/uploadOncloudinary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to generate upload URL");
    return await res.json(); // expects: { uploadUrl }
}
export async function getConversations() {
    const res = await fetch("/api/conversations");
    if (!res.ok) throw new Error("Failed to load conversations");
    return await res.json();
}
export async function getConversationById(id: string) {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) throw new Error("Conversation fetch failed");
    return res.json();
}

