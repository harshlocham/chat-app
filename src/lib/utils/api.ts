// lib/api.ts
//import axios from "axios";

/**
 * Fetches information about the currently authenticated user.
 *
 * @returns The parsed JSON object for the current user.
 * @throws If the request fails or the server responds with a non-OK status.
 */
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
/**
 * Change a user's role/permission via the admin API.
 *
 * @param id - The user ID to update
 * @param role - The new role to assign to the user
 * @returns The parsed JSON response from the server
 */
export async function changePermission(id: string, role: string) {
    const res = await fetch(`/api/admin/changeRoal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
    });
    if (!res.ok) throw new Error("Failed to change role");
    return await res.json();
}
/**
 * Delete a conversation by its ID.
 *
 * @param id - The conversation's identifier
 * @returns The parsed JSON response from the server
 * @throws Error with message "Failed to delete conversation" when the HTTP response status is not OK
 */
export async function deleteConversation(id: string) {
    const res = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete conversation");
    return await res.json();
}

/**
 * Delete a message identified by its ID.
 *
 * @param id - The ID of the message to delete
 * @returns The parsed JSON response from the delete API request
 * @throws Error if the API responds with a non-OK status
 */
export async function deleteMessage(id: string) {
    const res = await fetch(`/api/messages/${id}/delete`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete message");
    //socket.emit("message:delete", { messageId: id });
    return await res.json();
}
/**
 * Send an emoji reaction for a specific message on behalf of a user.
 *
 * @param id - The ID of the message to react to
 * @param emoji - The emoji to add as the reaction
 * @param userId - The ID of the user adding the reaction
 * @returns The parsed JSON response from the server
 * @throws Error if the server responds with a non-OK status
 */
export async function reactToMessage(id: string, emoji: string, userId: string) {
    const res = await fetch(`/api/messages/${id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, userId }),
    });
    if (!res.ok) throw new Error("Failed to react to message");
    return await res.json();
}