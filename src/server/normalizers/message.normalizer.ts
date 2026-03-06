import { MessageDTO } from "../../shared/dto/message.dto.js";
import { IMessagePopulated } from "../../models/Message.js";
import type { ClientReaction } from "../../shared/types/client-message.js";
import { ClientUser } from "../../shared/types/user.js";

// src/server/normalizers/message.normalizer.ts
export function normalizeMessage(doc: IMessagePopulated): MessageDTO {
    // DEBUG: Log reactions to diagnose missing reactions
    if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('normalizeMessage reactions:', JSON.stringify(doc.reactions));
    }
    type ReactionUser =
        | string
        | { _id: { toString(): string } }
        | { toString(): string };
    type DeliveryEntry =
        | { user?: { toString(): string } }
        | { toString(): string };
    type SeenEntry =
        | { user?: { toString(): string } }
        | { toString(): string };
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

        createdAt: new Date(doc.createdAt).toISOString(),
        updatedAt: doc.updatedAt
            ? new Date(doc.updatedAt).toISOString()
            : undefined,

        isDeleted: doc.isDeleted,
        isEdited: doc.isEdited,
        editedAt: doc.isEdited && doc.updatedAt
            ? new Date(doc.updatedAt).toISOString()
            : undefined,

        reactions: doc.reactions
            ? normalizeReactions(
                Object.fromEntries(
                    Object.entries(doc.reactions).map(([emoji, users]) => {
                        let userArr: any[] = [];
                        if (Array.isArray(users)) {
                            userArr = users;
                        } else if (users && typeof users === 'object' && typeof (users as Map<any, any>).values === 'function') {
                            userArr = Array.from((users as Map<any, any>).values());
                        } else if (users) {
                            userArr = [users];
                        }
                        return [
                            emoji,
                            userArr.map((user: any) =>
                                typeof user === "string"
                                    ? user
                                    : "_id" in user
                                        ? user._id.toString()
                                        : user.toString()
                            )
                        ];
                    })
                )
            )
            : [],

        seenBy: doc.seenBy
            ? doc.seenBy.map((entry: SeenEntry) =>
                "user" in entry && entry.user
                    ? entry.user.toString()
                    : entry.toString()
            )
            : [],

        deliveredTo: doc.deliveredTo
            ? doc.deliveredTo.map((entry: DeliveryEntry) =>
                "user" in entry && entry.user
                    ? entry.user.toString()
                    : entry.toString()
            )
            : [],
        repliedTo: doc.repliedTo ? {
            _id: doc.repliedTo._id.toString(),
            content: doc.repliedTo.content,
            sender: {
                _id: doc.repliedTo.sender._id.toString(),
                username: doc.repliedTo.sender.username,
                profilePicture: doc.repliedTo.sender.profilePicture,
            }
        } : null,
    };
}
export function normalizeReactions(
    reactions?: Record<string, any[]>
): { emoji: string; users: string[] }[] | undefined {
    if (!reactions) return undefined;

    return Object.entries(reactions).map(([emoji, users]) => {
        let userArr: any[] = [];
        if (Array.isArray(users)) {
            userArr = users;
        } else if (users && typeof users === 'object' && typeof (users as Map<any, any>).values === 'function') {
            userArr = Array.from((users as Map<any, any>).values()); // handle Map
        } else if (users) {
            userArr = [users];
        }
        return {
            emoji,
            users: userArr.map((user: any) =>
                typeof user === "string"
                    ? user
                    : "_id" in user
                        ? user._id.toString()
                        : user.toString()
            ),
        };
    });
}