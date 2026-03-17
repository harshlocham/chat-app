import { connectToDatabase } from "@/lib/Db/db";
import { User } from "@/models/User";
import { NextResponse } from "next/server";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ email: string }> }
) {
    const { email } = await params;

    try {
        await connectToDatabase();
        const user = await User
            .findOne({ email });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            id: user._id.toString(),
            name: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            isAdmin: user.role === "admin",
        });
    } catch (error) {
        console.error("Error fetching user:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
