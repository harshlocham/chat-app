import { NextResponse } from "next/server";
import { User } from "@/models/User";
import { connectToDatabase } from "@/lib/Db/db";

/**
 * Handles PATCH requests to update a user's status.
 *
 * @param req - Request whose JSON body must include `id` (the user's identifier) and `status` (the new status value)
 * @returns `NextResponse` with `{ success: true }` on success; on failure returns a JSON error with an appropriate HTTP status: `404` when the user is not found, `500` for server errors
 */
export async function PATCH(req: Request) {
    const body = await req.json();
    const { id, status } = body;
    try {
        await connectToDatabase();
        const user = await User.findById(id);
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        user.status = status;
        await user.save();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating user status:", error);
        return NextResponse.json({ error: "Failed to update user status" }, { status: 500 });
    }
}