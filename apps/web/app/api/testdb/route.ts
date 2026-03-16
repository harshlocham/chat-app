// src/app/api/test-db/route.ts
import { connectToDatabase } from "@/lib/Db/db";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        await connectToDatabase();
        return NextResponse.json({ success: true, message: "Connected to MongoDB" });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message });
    }
}
