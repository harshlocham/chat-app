import { cookies } from "next/headers";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/Db/db";
import { User } from "@/models/User";
import { authConfig, verifyAccessToken } from "@chat/auth";

export type AuthUser = {
    id: string;
    email: string;
    role: string;
};

export async function getAuthUser(): Promise<AuthUser | null> {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(authConfig.cookie.accessToken)?.value;
    if (!accessToken) return null;

    let payload: { sub: string; role?: string; type: "access" };

    try {
        payload = verifyAccessToken(accessToken);
    } catch {
        return null;
    }

    if (!payload?.sub || !mongoose.Types.ObjectId.isValid(payload.sub)) {
        return null;
    }

    await connectToDatabase();
    const user = await User.findById(payload.sub)
        .select("_id email role status")
        .lean<{ _id: { toString(): string }; email: string; role?: string; status?: string } | null>();

    if (!user) return null;
    if (user.status === "banned") return null;

    return {
        id: user._id.toString(),
        email: user.email,
        role: payload.role || user.role || "user",
    };
}
