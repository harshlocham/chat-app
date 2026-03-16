import { NextRequest, NextResponse } from "next/server";
import { createMessage } from "@/lib/services/message.service";
import { CreateMessageSchema } from "@/lib/validators/message.schema";
import { getPaginatedMessages } from "@/lib/repositories/message.repo";
import { normalizeMessage } from "@/server/normalizers/message.normalizer";
import { getAuthUser } from "@/lib/utils/auth/getAuthUser";

//import { messageRateLimiter } from "@/lib/utils/rateLimiter";

export async function POST(req: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }
        const senderId = authUser.id;
        // const identifier = session.user.email;
        //const { success } = await messageRateLimiter.limit(identifier);
        //if (!success) return NextResponse.json({ error: "Too many messages" }, { status: 429 });
        const requestBody = await req.json();
        const parsed = CreateMessageSchema.parse(requestBody);
        const message = await createMessage(parsed, senderId);
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
export async function GET(req: NextRequest) {
    try {

        const { searchParams } = new URL(req.url);
        const conversationId = searchParams.get("conversationId")!;
        const cursor = searchParams.get("cursor") || undefined;

        const messages = await getPaginatedMessages(conversationId, cursor);
        const clientMessages = (Array.isArray(messages) ? messages : []).map(normalizeMessage);
        // Always return an array, even if empty:
        return NextResponse.json(clientMessages, { status: 200 });
    } catch (err) {
        console.error(err);
        // Return an empty array instead of no body:
        return NextResponse.json([], { status: 200 });
    }
}