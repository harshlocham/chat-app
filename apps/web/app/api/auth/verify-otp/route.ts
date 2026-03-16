import { NextResponse } from "next/server";
import Otp from "@/models/OTP";
import { connectToDatabase } from "@/lib/Db/db";
import bcrypt from "bcryptjs";
import { User } from "@/models/User";

export async function POST(req: Request) {
    try {
        await connectToDatabase();
        const { email, otp, name, password } = await req.json();

        if (!email || !otp) {
            return NextResponse.json({ success: false, message: "Email and OTP are required" }, { status: 400 });
        }

        // Find the OTP record
        const record = await Otp.findOne({ email });
        if (!record) {
            return NextResponse.json({ success: false, message: "Invalid email" }, { status: 400 });
        }
        // verifiy the otp
        const valid = await bcrypt.compare(otp, record.otp);
        if (!valid) {
            return NextResponse.json({ success: false, message: "Invalid OTP" }, { status: 400 });
        }

        // OTP is valid — you can now verify the user account or create a session
        await Otp.deleteMany({ email }); // Clean up used OTP

        // Example: mark user as verified in User collection and create a new user
        let user = await User.findOne({ email });
        if (!user) {
            const hashedPassword = await bcrypt.hash(password, 10);
            user = await User.create({
                username: name,
                email,
                password: hashedPassword,
                isVerified: Date.now(),
            });
        }
        // await User.updateOne({ email }, { $set: { isVerified: true } });

        return NextResponse.json({ success: true, message: "OTP verified successfully" });
    } catch (error) {
        console.log("Verify OTP error:", error);
        return NextResponse.json({ success: false, message: "Failed to verify OTP" }, { status: 500 });
    }
}