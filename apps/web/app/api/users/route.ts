// /pages/api/users.ts
import { connectToDatabase } from "@/lib/Db/db";
import { User } from "@/models/User";
import { requireAuthUser } from "@/lib/utils/auth/requireAuthUser";



export async function GET() {
    const guard = await requireAuthUser();
    if (guard.response) {
        return guard.response;
    }

    await connectToDatabase();

    const users = await User.find({ email: { $ne: guard.user.email } }).select("-password");
    return new Response(JSON.stringify(users), { status: 200 });
}
