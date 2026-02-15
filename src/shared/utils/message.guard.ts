import type { ClientMessage } from "../types/message.js";

export function isClientMessage(obj: any): obj is ClientMessage {
    return (
        typeof obj === "object" &&
        typeof obj._id === "string" &&
        typeof obj.conversationId === "string" &&
        typeof obj.content === "string" &&
        typeof obj.createdAt === "string"
    );
}