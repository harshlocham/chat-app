import { IMessagePopulated } from "@/models/Message";
import { ITempMessage } from "@/models/TempMessage";
import { ClientMessage, ClientReaction } from "@/shared/types/client-message";
import { UIMessage } from "@/shared/types/ui-message";

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
        createdAt: String(msg.createdAt),
        isDeleted: msg.isDeleted,
        isEdited: msg.isEdited,
        status: msg.status,
    };
}
export function fromTempMessage(msg: ITempMessage): UIMessage {
    return {
        _id: msg._id.toString(),
        conversationId: msg.conversationId,
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
        status: "pending",
    };
}
export function normalizeReply(
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
        _id: "",
        content: "",
        sender: { _id: "" },
    };
}