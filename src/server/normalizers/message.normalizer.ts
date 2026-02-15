import type { ClientMessage } from "../../types/client-message.js";

/**
 * Normalize a raw message document into a ClientMessage.
 *
 * @param doc - Raw database document representing a message
 * @returns A ClientMessage with string IDs (`_id`, `conversationId`, `sender`), `content` set to `null` when the message is deleted, `createdAt` as an ISO string, `messageType`, boolean flags `isEdited` and `isDeleted`, `reactions` (defaults to an empty array), and `deliveredTo` / `seenBy` as arrays of string IDs (default to empty arrays)
 */
export function normalizeMessage(doc: any): ClientMessage {
    return {
        _id: doc._id.toString(),
        conversationId: doc.conversationId.toString(),
        sender: doc.sender.toString(),

        content: doc.isDeleted ? null : doc.content,
        messageType: doc.messageType,

        createdAt: doc.createdAt.toISOString(),
        isEdited: doc.isEdited,
        isDeleted: doc.isDeleted,

        reactions: doc.reactions ?? [],
        deliveredTo: doc.deliveredTo?.map(String) ?? [],
        seenBy: doc.seenBy?.map(String) ?? [],
    };
}