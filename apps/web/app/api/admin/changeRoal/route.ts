import { NextResponse } from "next/server";
import { User } from "@/models/User";
import { connectToDatabase } from "@/lib/Db/db";
import { requireAdminUser } from "@/lib/utils/auth/requireAdminUser";

export async function PATCH(req: Request) {
    const guard = await requireAdminUser();
    if (guard.response) {
        return guard.response;
    }

    const body = await req.json();
    const { id, role } = body;

    if (!id || (role !== "user" && role !== "moderator" && role !== "admin")) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const user = await User.findById(id);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        user.role = role;
        await user.save();
        return NextResponse.json({ userrole: user.role });
    } catch (error) {
        console.error("Error updating user status:", error);
        return NextResponse.json({ error: "Failed to update user status" }, { status: 500 });
    }
}