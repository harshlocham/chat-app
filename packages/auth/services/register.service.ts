import { User } from "@/models/User";
import { hashPassword } from "../password/hash";

export const registerService = async ({
    username,
    email,
    password,
}: {
    username: string;
    email: string;
    password: string;
}) => {
    const existing = await User.findOne({ email });
    if (existing) {
        throw new Error("User already exists");
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
        username,
        email,
        password: hashedPassword,
        isVerified: new Date(),
        status: "active",
        role: "user",
        isOnline: false,
        conversations: [],
    });

    return user;
};
