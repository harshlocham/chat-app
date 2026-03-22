import { randomInt } from "node:crypto";
import Otp from "@/models/OTP";
import { User } from "@/models/User";
import { comparePassword } from "../password/compare";
import { hashPassword } from "../password/hash";
import { registerService } from "./register.service";

const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_EXPIRY_MS = 5 * 60 * 1000;

type SendEmailOtpInput = {
    email: string;
    sendOtpEmail: (email: string, otp: string) => Promise<void>;
};

type VerifyEmailOtpInput = {
    email: string;
    otp: string;
};

type VerifyOtpAndRegisterInput = {
    email: string;
    otp: string;
    username: string;
    password: string;
};

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export async function sendEmailOtpService({
    email,
    sendOtpEmail,
}: SendEmailOtpInput): Promise<{ cooldownMs: number; expiresInMs: number }> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        throw new Error("Email is required");
    }

    const existing = await Otp.findOne({ email: normalizedEmail });
    if (existing && existing.createdAt.getTime() > Date.now() - OTP_COOLDOWN_MS) {
        throw new Error("Please wait before requesting another OTP");
    }

    const otp = randomInt(100000, 1000000).toString();
    await Otp.deleteMany({ email: normalizedEmail });

    const hashedOtp = await hashPassword(otp);
    await Otp.create({
        email: normalizedEmail,
        otp: hashedOtp,
        createdAt: new Date(),
    });

    await sendOtpEmail(normalizedEmail, otp);

    return {
        cooldownMs: OTP_COOLDOWN_MS,
        expiresInMs: OTP_EXPIRY_MS,
    };
}

export async function verifyEmailOtpService({ email, otp }: VerifyEmailOtpInput): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !otp?.trim()) {
        throw new Error("Email and OTP are required");
    }

    const record = await Otp.findOne({ email: normalizedEmail });
    if (!record) {
        throw new Error("Invalid or expired OTP");
    }

    if (record.createdAt.getTime() < Date.now() - OTP_EXPIRY_MS) {
        await Otp.deleteMany({ email: normalizedEmail });
        throw new Error("Invalid or expired OTP");
    }

    const valid = await comparePassword(otp.trim(), record.otp);
    if (!valid) {
        throw new Error("Invalid or expired OTP");
    }

    await Otp.deleteMany({ email: normalizedEmail });
}

export async function verifyOtpAndRegisterService({
    email,
    otp,
    username,
    password,
}: VerifyOtpAndRegisterInput) {
    await verifyEmailOtpService({ email, otp });

    const normalizedEmail = normalizeEmail(email);
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
        user = await registerService({
            username: username.trim(),
            email: normalizedEmail,
            password,
        });
    }

    return user;
}