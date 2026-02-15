import { NextRequest, NextResponse } from "next/server";
import Message from "@/models/Message";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/auth/auth";
import { connectToDatabase } from "@/lib/Db/db";

/**
 * Mark a message as delivered for the authenticated user.
 *
 * Adds an entry to the message's `deliveredTo` array with the current user's id and a timestamp (provided `at` or now), after verifying authentication, message existence, and that the requester is not the sender.
 *
 * @param req - Incoming request whose JSON body may include `at` (an ISO timestamp or value accepted by `Date`).
 * @param params - Route params promise that resolves to an object with `id` (the message identifier).
 * @returns A NextResponse containing `{ success: true }` on successful update; on failure returns a JSON error with an appropriate HTTP status (`401`, `403`, `404`, or `500`).
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const { at } = await req.json();
        await connectToDatabase();
        const message = await Message.findById(id);
        if (!message) {
            return NextResponse.json({ error: "Message not found" }, { status: 404 });
        }

        const userId = session.user.id;

        // ❌ sender should NOT mark delivered
        if (message.sender.toString() === userId) {
            return NextResponse.json(
                { error: "Sender cannot mark delivered" },
                { status: 403 }
            );
        }

        // ✅ idempotent check
        // const alreadyDelivered = message.deliveredTo.some(
        //     d=> d.userId.toString() === userId
        // );

        // if (!alreadyDelivered) {
        message.deliveredTo.push({
            userId,
            at: at ? new Date(at) : new Date(),
        });
        await message.save();
        // }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("PATCH /api/messages/:id/delivered error", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}