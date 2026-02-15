import { NextResponse } from "next/server";
import { User } from "@/models/User";
import { connectToDatabase } from "@/lib/Db/db";

/**
 * Updates a user's role by ID and returns the updated role in a JSON response.
 *
 * @returns A JSON NextResponse with `{ userrole: string }` on success; if the user is not found returns `{ error: "User not found" }` with status 404; on failure returns `{ error: "Failed to update user status" }` with status 500.
 */
export async function PATCH(req: Request) {
    const body = await req.json();
    const { id, role } = body;
    try {
        await connectToDatabase();
        const user = await User.findById(id)
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