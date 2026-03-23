import { Conversation } from "@/models/Conversation";
import { connectToDatabase } from "@/lib/Db/db";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/utils/auth/getAuthUser";
import mongoose from "mongoose";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const authUser = await getAuthUser();
    if (!authUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });
    }

    const convo = await Conversation.findById(id)
        .populate("participants", "username email profilePicture");

    if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isParticipant = convo.participants.some((participant: { _id: { toString(): string } }) => {
        return participant._id.toString() === authUser.id;
    });

    if (!isParticipant && authUser.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(convo);
}
