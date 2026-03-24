// /pages/api/me.ts
import { connectToDatabase } from "@/lib/Db/db";
import { User } from "@/models/User";
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/utils/auth/requireAuthUser";
import mongoose from "mongoose";


export async function GET() {
    const guard = await requireAuthUser();
    if (guard.response) {
        return guard.response;
    }

    await connectToDatabase();

    const userById = mongoose.Types.ObjectId.isValid(guard.user.id)
        ? await User.findById(guard.user.id).select("-password -isVerified -twoFactorEnabled")
        : null;
    const user = userById || (await User.findOne({ email: guard.user.email }).select("-password -isVerified -twoFactorEnabled"));

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
}
