// /pages/api/me.ts
import { connectToDatabase } from "@/lib/Db/db";
import { User } from "@/models/User";
import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/utils/auth/authResponses";
import { isAuthError } from "@/lib/utils/auth/authErrors";
import { validateAuthUser } from "@/lib/utils/auth/validateAuthUser";
import mongoose from "mongoose";


export async function GET() {
    let authUser;
    try {
        // Optional short TTL Redis cache keeps auth checks fast while still DB-backed.
        authUser = await validateAuthUser({ useRedisCache: true, cacheTtlSeconds: 45 });
    } catch (error) {
        if (isAuthError(error)) {
            return authErrorResponse(error);
        }

        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const userById = mongoose.Types.ObjectId.isValid(authUser.id)
        ? await User.findById(authUser.id).select("-password -isVerified -twoFactorEnabled")
        : null;
    const user = userById || (await User.findOne({ email: authUser.email }).select("-password -isVerified -twoFactorEnabled"));

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
}
