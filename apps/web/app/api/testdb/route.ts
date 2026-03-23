// src/app/api/test-db/route.ts
import { connectToDatabase } from "@/lib/Db/db";
import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/utils/auth/requireAdminUser";

export async function GET() {
    const guard = await requireAdminUser();
    if (guard.response?.status === 401) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (guard.response?.status === 403) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    try {
        await connectToDatabase();
        return NextResponse.json({ success: true, message: "Connected to MongoDB" });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message });
    }
}
