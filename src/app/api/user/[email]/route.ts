import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { NextResponse } from "next/server";


export async function GET(request: Request, context: { params: { email: string } }) {
    const { params } = context;
    const { email } = await params; // 👈 This is the key change

    try {
        await connectToDatabase();
        const user = await User.findOne({ email })

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            id: user._id.toString(),
            name: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            isAdmin: user.isAdmin,

        });
    } catch (error) {
        console.error("Error fetching user:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
