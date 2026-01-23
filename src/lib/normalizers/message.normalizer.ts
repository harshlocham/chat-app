import { IMessagePopulated } from "@/models/Message";
import { ClientMessage } from "@/types/client-message";

export function toClientMessage(msg: IMessagePopulated): ClientMessage {
    return {
        _id: msg._id.toString(),
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
        reactions: msg.reactions,
        repliedTo: msg.repliedTo ? toClientMessage(msg.repliedTo) : null,
        createdAt: msg.createdAt,
        isDeleted: msg.isDeleted,
        isEdited: msg.isEdited,
    };
}
export function fromTempMessage(msg: ITempMessage): UIMessage {
    return {
        _id: msg.tempId,
        conversationId: msg.conversationId,

        senderId: idToString(msg.senderId),
        sender: {
            _id: msg.sender._id,
            username: msg.sender.username,
            profilePicture: msg.sender.profilePicture,
        },

        text: msg.content,
        messageType: msg.messageType,

        createdAt: msg.createdAt,

        isTemp: true,
        isDeleted: false,

        repliedTo: normalizeReply(msg.repliedTo),
    };
}
function normalizeReply(repliedTo: any) {
    if (!repliedTo) return null;

    // Case 1: already normalized
    if (typeof repliedTo === "object" && "text" in repliedTo) {
        return {
            _id: repliedTo._id?.toString() ?? "",
            text: repliedTo.text ?? repliedTo.content ?? "",
            senderId:
                repliedTo.senderId?.toString() ??
                repliedTo.sender?._id?.toString() ??
                "",
        };
    }

    // Case 2: raw ObjectId → drop content (feature mode)
    if (typeof repliedTo === "string" || repliedTo?.toString) {
        return {
            _id: repliedTo.toString(),
            text: "",
            senderId: "",
        };
    }

    return null;
}