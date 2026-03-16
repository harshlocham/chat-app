import { getServerSession } from "next-auth";
import { connectToDatabase } from "@/lib/Db/db";
import { User } from "@/models/User";
import { authOptions } from "./auth";

export type AuthUser = {
    id: string;
    email: string;
    role: string;
};

export async function getAuthUser(): Promise<AuthUser | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;

    if (session.user.id && session.user.email) {
        return {
            id: String(session.user.id),
            email: String(session.user.email),
            role: String(session.user.role || "user"),
        };
    }

    if (!session.user.email) return null;

    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email })
        .select("_id email role")
        .lean<{ _id: { toString(): string }; email: string; role?: string } | null>();

    if (!user) return null;

    return {
        id: user._id.toString(),
        email: user.email,
        role: user.role || "user",
    };
}
