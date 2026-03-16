// /pages/api/users.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/auth/auth";
import { connectToDatabase } from "@/lib/Db/db";
import { User } from "@/models/User";



export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    }

    await connectToDatabase();

    const users = await User.find({ email: { $ne: session.user.name } }).select("-password");
    return new Response(JSON.stringify(users), { status: 200 });
}
