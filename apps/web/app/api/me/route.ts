// /pages/api/me.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/auth/auth";
import { connectToDatabase } from "@/lib/Db/db";
import { User } from "@/models/User";
import { NextResponse } from "next/server";


export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findOne({ email: session.user.email }).select("-password -isVerified -twoFactorEnabled");
    return NextResponse.json(user);
}
