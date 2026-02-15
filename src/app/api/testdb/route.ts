// src/app/api/test-db/route.ts
import { connectToDatabase } from "@/lib/Db/db";
import { NextResponse } from "next/server";

/**
 * Performs a database connection check and returns a JSON result indicating success or failure.
 *
 * If the connection succeeds, the response contains `{ success: true, message: "Connected to MongoDB" }`.
 * If the connection fails, the response contains `{ success: false, error: <error message> }`.
 *
 * @returns A JSON response with a `success` boolean; on success includes `message`, on failure includes `error` string.
 */
export async function GET() {
    try {
        await connectToDatabase();
        return NextResponse.json({ success: true, message: "Connected to MongoDB" });
    } catch (error) {
        return NextResponse.json({ success: false, error: (error as Error).message });
    }
}