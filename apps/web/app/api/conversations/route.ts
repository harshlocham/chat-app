// /pages/api/conversations.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/auth/auth";
import { connectToDatabase } from "@/lib/Db/db";
import { Conversation } from "@/models/Conversation";
import { User } from "@/models/User";
import { NextResponse } from "next/server";


export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        await connectToDatabase();

        const currentUser = await User.findOne({ email: session.user.email });
        if (!currentUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const body = await req.json();
        const { participants, isGroup, groupName, image, admin } = body;

        if (!participants || participants.length === 0) {
            return NextResponse.json({ error: "Participants required" }, { status: 400 });
        }

        // Check for existing conversation (only if not a group chat)
        if (!isGroup && participants.length === 2) {
            const existing = await Conversation.findOne({
                isGroup: false,
                participants: { $all: participants },
            });

            if (existing) {
                const populated = await existing.populate("participants", "name email image");
                return NextResponse.json(populated, { status: 200 });
            }
        }

        // Create new conversation
        const newConversation = await Conversation.create({
            isGroup,
            participants,
            ...(isGroup && {
                groupName,
                image,
                admin,
            }),
        });

        const populated = await newConversation.populate("participants", "name email image");
        return NextResponse.json(populated, { status: 201 });

    } catch (error) {
        console.error("POST /api/conversations error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}


export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    try {
        await connectToDatabase();
        const user = await User.findOne({ email: session.user.email });
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }



        const conversations = await Conversation.find({
            participants: user._id,
        })
            .populate("participants", "username email profilePicture")
            .populate({
                path: "lastMessage",
                populate: {
                    path: "sender",
                    select: "username email profilePicture",
                },
            })
            .sort({ updatedAt: -1 })
            .lean();

        return NextResponse.json(conversations, { status: 200 });
    } catch (error) {
        console.error("Error fetching conversations:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    }

    const { conversationId } = await req.json();

    await connectToDatabase();

    const deletedConv = await Conversation.findByIdAndDelete(conversationId);

    if (!deletedConv) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), { status: 404 });
    }

    return new Response(JSON.stringify({ message: "Conversation deleted successfully" }), { status: 200 });
}

