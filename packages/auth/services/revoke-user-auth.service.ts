import { User } from "@/models/User";
import { deleteUserSessions } from "../repositories/session.repo";

export async function revokeUserAuthSessions(userId: string): Promise<{ userId: string; tokenVersion: number }> {
    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { tokenVersion: 1 } },
        { new: true }
    )
        .select("_id tokenVersion")
        .lean<{ _id: { toString(): string }; tokenVersion?: number } | null>();

    if (!updatedUser) {
        throw new Error("User not found");
    }

    await deleteUserSessions(updatedUser._id.toString());

    return {
        userId: updatedUser._id.toString(),
        tokenVersion: updatedUser.tokenVersion || 0,
    };
}
