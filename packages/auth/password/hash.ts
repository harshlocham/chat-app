import bcrypt from "bcryptjs";

export const hashPassword = async (password: string): Promise<string> => {
    return bcrypt.hash(password, 10);
};