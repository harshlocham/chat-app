import { Conversation } from "@/models/Conversation";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // ... authenticate, then:
    const { id } = await params;
    const convo = await Conversation.findById(id)
        .populate("participants", "name email image");
    if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(convo);
}
