import { IMessagePopulated } from "../../models/Message.js";
import type { ClientMessage, ClientReaction } from "../../shared/types/client-message.js";

// src/server/normalizers/message.normalizer.ts
export function normalizeMessage(doc: IMessagePopulated): ClientMessage {
    return {
        _id: doc._id.toString(),
        conversationId: doc.conversationId.toString(),

        content: doc.content,
        messageType: doc.messageType,

        sender: {
            _id: doc.sender._id.toString(),
            username: doc.sender.username,
            profilePicture: doc.sender.profilePicture,
        },

        repliedTo: doc.repliedTo
            ? {
                _id: doc.repliedTo._id.toString(),
                content: doc.repliedTo.content,
                sender: {
                    _id: doc.repliedTo.sender._id.toString(),
                    username: doc.repliedTo.sender.username,
                    profilePicture: doc.repliedTo.sender.profilePicture,
                },
            }
            : null,

        reactions: Array.isArray(doc.reactions)
            ? doc.reactions.map((reaction) => ({
                emoji: reaction.emoji,
                users: (reaction.users ?? []).map((user: any) =>
                    typeof user === "string"
                        ? user
                        : user._id
                            ? user._id.toString()
                            : user.toString()
                ),
            }))
            : undefined,

        createdAt: doc.createdAt,
        editedAt: doc.isEdited ? doc.updatedAt?.toISOString() : undefined,
        // deletedAt: doc.isDeleted ? doc.updatedAt?.toISOString() : undefined,

        isEdited: doc.isEdited,
        isDeleted: doc.isDeleted,
    };
}
export function normalizeReactions(
    reactions?: Record<string, string[]>
): ClientReaction[] | undefined {
    if (!reactions) return undefined;

    return Object.entries(reactions).map(([emoji, users]) => ({
        emoji,
        users,
    }));
}