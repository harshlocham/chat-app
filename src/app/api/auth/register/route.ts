import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import bcrypt from "bcryptjs";


export async function POST(req: Request) {
    const { username, email, password } = await req.json();
    try {
        connectToDatabase();
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return new Response(JSON.stringify({ error: "User already exists" }), { status: 400 });
        }
        const hashedpassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            email,
            password: hashedpassword,
        })

        return new Response(JSON.stringify(user), { status: 201 });
    } catch (error) {
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });

    }
}