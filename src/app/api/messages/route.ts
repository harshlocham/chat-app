import { NextRequest, NextResponse } from "next/server";
import { handleCreateMessage } from "@/lib/socket/controllers/message.controller";
import { CreateMessageSchema } from "@/lib/validators/message.schema";
import { getPaginatedMessages } from "@/lib/repositories/message.repo";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/auth/auth";
import { normalizeMessage } from "@/server/normalizers/message.normalizer";

/**
 * Create a new message for the currently authenticated user and return the normalized client payload.
 *
 * Validates the request body against the CreateMessageSchema, requires an active server session, and normalizes the created message for the client.
 *
 * @param req - The incoming NextRequest containing the message payload in the request body.
 * @returns A NextResponse containing the normalized created message with status 201 on success; an error object with status 401 if the user is not authenticated; or an error object with status 400 on validation or creation failure.
 */

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }
        const senderId = session.user.id;
        // const identifier = session.user.email;
        //const { success } = await messageRateLimiter.limit(identifier);
        //if (!success) return NextResponse.json({ error: "Too many messages" }, { status: 429 });
        const requestBody = await req.json();
        const parsed = CreateMessageSchema.parse(requestBody);
        const message = await handleCreateMessage(parsed, senderId);
        const clientMessage = normalizeMessage(message);

        return NextResponse.json(clientMessage, { status: 201 });
    } catch (error) {
        console.error("❌ Message POST error:", error);

        return NextResponse.json(
            { error: error || "Invalid input" },
            { status: 400 }
        );
    }
}
/**
 * Retrieve paginated messages for a conversation and return them normalized for the client.
 *
 * Reads `conversationId` (required) and `cursor` (optional) from the request URL's query parameters,
 * fetches the corresponding page of messages, and returns each message in client-facing form.
 *
 * @param req - Incoming request containing `conversationId` and optional `cursor` query parameters
 * @returns An array of normalized message objects; returns an empty array if an error occurs
 */
export async function GET(req: NextRequest) {
    try {

        const { searchParams } = new URL(req.url);
        const conversationId = searchParams.get("conversationId")!;
        const cursor = searchParams.get("cursor") || undefined;

        const messages = await getPaginatedMessages(conversationId, cursor);
        const clientMessages = messages.map(normalizeMessage);
        // Always return an array, even if empty:
        return NextResponse.json(clientMessages, { status: 200 });
    } catch (err) {
        console.error(err);
        // Return an empty array instead of no body:
        return NextResponse.json([], { status: 200 });
    }
}