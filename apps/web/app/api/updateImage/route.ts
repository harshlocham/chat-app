import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/Db/db";
import { User } from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/auth/auth";

export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { imageUrl } = await request.json();

        if (!imageUrl) {
            return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
        }

        await connectToDatabase();

        const user = await User.findOneAndUpdate(
            { email: session.user.email },
            { $set: { profilePicture: imageUrl } },
            { new: true }
        );
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        user.save();

        return NextResponse.json({
            success: true,
            user: {
                _id: user._id,
                email: user.email,
                username: user.username,
                image: user.image
            }
        });
    } catch (error) {
        console.error("Update image error:", error);
        return NextResponse.json({ error: "Failed to update image" }, { status: 500 });
    }
}