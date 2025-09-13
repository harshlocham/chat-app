// lib/api.ts
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

export async function createConversation(data: {
    participants: string[];
    isGroup: boolean;
    groupName?: string;
    image?: string;
    admin?: string;
}) {
    const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create conversation");
    return await res.json(); // expects: { _id }
}
export async function generateUploadUrl(selectedFile: File) {
    const formData = new FormData();
    formData.append("file", selectedFile);
    const res = await fetch("/api/upload.ts", {
        method: "POST",
        body: formData,
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
export async function uppdateProfilePicture(imageUrl: string) {
    const res = await fetch("/api/updateImage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
    });
    if (!res.ok) throw new Error("Failed to update profile picture");
    return await res.json();
}
export async function toggleBan(id: string, status: string) {
    const res = await fetch(`/api/admin/toggleban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
    });
    if (!res.ok) throw new Error("Failed to toggle ban");
    return await res.json();
}
export async function changePermission(id: string, role: string) {
    const res = await fetch(`/api/admin/changeRoal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
    });
    if (!res.ok) throw new Error("Failed to change role");
    return await res.json();
}

