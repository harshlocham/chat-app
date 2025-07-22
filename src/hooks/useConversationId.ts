"use client"
import { useParams } from "next/navigation";

export const useConversationId = (): string | undefined => {
    const params = useParams();
    const id = params?.conversationId;

    if (Array.isArray(id)) return id[0];
    if (typeof id === "string") return id;

    return undefined;

};
