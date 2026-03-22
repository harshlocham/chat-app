import { comparePassword } from "../password/compare";
import { generateAccessToken } from "../tokens/generate";
import { createUserSession } from "../session/create-session";
import { User } from "@/models/User";

export const loginUser = async ({
    email,
    password,
    userAgent,
    ipAddress,
}: {
    email: string;
    password: string;
    userAgent?: string;
    ipAddress?: string;
}) => {
    const user = await User.findOne({ email });
    if (!user) throw new Error("User not found");

    if (!user.password) {
        throw new Error("Password login is not enabled for this account");
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) throw new Error("Invalid password");

    if (user.status === "banned") {
        throw new Error("Account is banned");
    }

    const accessToken = generateAccessToken({
        sub: user._id.toString(),
        role: user.role,
        type: "access",
    });

    const { refreshToken } = await createUserSession({
        userId: user._id.toString(),
        userAgent,
        ipAddress,
    });

    return {
        user,
        accessToken,
        refreshToken,
    };
};