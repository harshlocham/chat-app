import { connectToDatabase } from "@/lib/Db/db";
import Otp from "@/models/OTP";
import { sendOtpEmail } from "@/lib/utils/sendOtp";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authRateLimiter } from "@/lib/utils/rateLimiter"

export async function POST(req: NextRequest) {
    try {
        const ip = req.headers.get("x-forwarded-for") ?? "unknown";
        const { success } = await authRateLimiter.limit(ip);

        if (!success) {
            return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
        }
        await connectToDatabase();
        const { email } = await req.json();
        const existing = await Otp.findOne({ email });
        if (existing && existing.createdAt > Date.now() - 60 * 1000) { // 1 minute cooldown
            return NextResponse.json({ error: "Please wait before requesting another OTP" }, { status: 429 });
        }
        // Generate a random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry
        // Delete any old OTP for this email
        await Otp.deleteMany({ email });
        // Create a new OTP
        const hashedOtp = await bcrypt.hash(otp, 10);
        await Otp.create({ email: email, otp: hashedOtp, createdAt: expiresAt });
        // Send the OTP via email
        await sendOtpEmail(email, otp);

        return NextResponse.json({ success: true, message: "OTP sent successfully" });
    } catch (error) {
        console.error("Send OTP error:", error);
        return NextResponse.json({ success: false, message: "Failed to send OTP", status: 500 });
    }
}