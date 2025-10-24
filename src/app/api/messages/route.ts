import { NextRequest, NextResponse } from "next/server";
import { handleCreateMessage } from "@/lib/controllers/message.controller";
import { CreateMessageSchema } from "@/lib/validators/ message.schema";
import { getPaginatedMessages } from "@/lib/repositories/message.repo";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { messageRateLimiter } from "@/lib/rateLimiter";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }
        const identifier = session.user.email;
        const { success } = await messageRateLimiter.limit(identifier);
        if (!success) return NextResponse.json({ error: "Too many messages" }, { status: 429 });
        const parsed = CreateMessageSchema.parse(await req.json());

        const message = await handleCreateMessage(parsed);

        return NextResponse.json(message, { status: 201 });
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
        // Always return an array, even if empty:
        return NextResponse.json(messages, { status: 200 });
    } catch (err) {
        console.error(err);
        // Return an empty array instead of no body:
        return NextResponse.json([], { status: 200 });
    }
}