import { IMessagePopulated } from "@/models/Message";
import { ITempMessage } from "@/models/TempMessage";
import { ClientMessage, ClientReaction } from "@/types/client-message";
import { UIMessage } from "@/types/ui-message";

interface RawReply {
    _id?: { toString(): string } | string;
    text?: string;
    content?: string;
    senderId?: { toString(): string } | string;
    sender?: { _id?: { toString(): string } | string };
    toString?(): string;
}
interface UIReplyPreview {
    _id: string;
    content: string;
    sender: {
        _id: string;
        username?: string;
        profilePicture?: string;
    };
}

/**
 * Convert a populated IMessagePopulated into a ClientMessage suitable for client use.
 *
 * @param msg - The populated message object to convert (may contain populated sender and repliedTo).
 * @returns A ClientMessage with IDs converted to strings, sender normalized to an object or preserved as a string, reactions cast for client use, and `repliedTo` recursively converted or `null`.
 */
export function toClientMessage(msg: IMessagePopulated): ClientMessage {
    return {
        _id: msg._id.toString(),
        conversationId: msg.conversationId.toString(),
        content: msg.content,
        messageType: msg.messageType,
        sender:
            typeof msg.sender === "object"
                ? {
                    _id: msg.sender._id.toString(),
                    username: msg.sender.username,
                    profilePicture: msg.sender.profilePicture,
                }
                : msg.sender,
        reactions: msg.reactions as unknown as ClientReaction[],
        repliedTo: msg.repliedTo ? toClientMessage(msg.repliedTo) : null,
        createdAt: msg.createdAt,
        isDeleted: msg.isDeleted,
        isEdited: msg.isEdited,
    };
}
/**
 * Convert a temporary message record into a UIMessage suitable for client display.
 *
 * Produces a UIMessage with stringified `_id` and `senderId`, a populated `sender` object
 * (including `_id`, `username`, and `profilePicture`), `isTemp` set to `true`, `isDeleted`
 * set to `false`, and `repliedTo` normalized into a `UIReplyPreview` or `null`.
 *
 * @param msg - The temporary message to convert
 * @returns The resulting `UIMessage` ready for the UI
 */
export function fromTempMessage(msg: ITempMessage): UIMessage {
    return {
        _id: msg._id.toString(),
        conversationId: msg.conversationId,

        senderId: msg.senderId.toString(),
        sender: {
            _id: msg.sender._id.toString(),
            username: msg.sender.username,
            profilePicture: msg.sender.profilePicture,
        },

        content: msg.content,
        messageType: msg.messageType,
        createdAt: msg.createdAt,

        isTemp: true,
        isDeleted: false,

        repliedTo: normalizeReply(msg.repliedTo),
    };
}
/**
 * Normalize a raw reply reference into a lightweight UI reply preview or `null`.
 *
 * @param repliedTo - A reply reference which may be `null`/`undefined`, a string/ObjectId, or a partially/fully populated reply object containing fields like `_id`, `text`, `content`, `senderId`, or `sender`.
 * @returns A `UIReplyPreview` for the provided reply, or `null` if `repliedTo` is falsy. The preview's `_id` and `sender._id` are stringified when available; `content` is the reply text or content, or an empty string if unknown.
function normalizeReply(
    repliedTo: RawReply | string | null | undefined
): UIReplyPreview | null {
    if (!repliedTo) return null;

    // fully populated
    if (typeof repliedTo === "object" && ("text" in repliedTo || "content" in repliedTo)) {
        return {
            _id: repliedTo._id?.toString() ?? "",
            content: repliedTo.text ?? repliedTo.content ?? "",
            sender: {
                _id:
                    repliedTo.senderId?.toString() ??
                    repliedTo.sender?._id?.toString() ??
                    "",
            },
        };
    }

    // ObjectId only → fallback preview
    return {
        _id: repliedTo.toString(),
        content: "",
        sender: { _id: "" },
    };
}