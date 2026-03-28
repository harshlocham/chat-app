import { User } from "@/models/User";
import { hashPassword } from "../password/hash";

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export const registerService = async ({
    username,
    email,
    password,
}: {
    username: string;
    email: string;
    password: string;
}) => {
    const normalizedEmail = normalizeEmail(email);
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
        throw new Error("User already exists");
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
        username,
        email: normalizedEmail,
        password: hashedPassword,
        authProviders: ["password"],
        isVerified: new Date(),
        status: "active",
        role: "user",
        isOnline: false,
        conversations: [],
    });

    return user;
};
