import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/Db/db";
import { User } from "@/models/User";

type Role = "user" | "moderator" | "admin";

type LeanUser = {
    _id: { toString(): string };
    email: string;
    username: string;
    password?: string;
    role?: Role;
    profilePicture?: string;
};

const providers: NextAuthOptions["providers"] = [
    CredentialsProvider({
        name: "Credentials",
        credentials: {
            email: { label: "Email", type: "email" },
            password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
            const email = credentials?.email?.trim();
            const password = credentials?.password;
            if (!email || !password) return null;

            await connectToDatabase();
            const user = await User.findOne({ email }).lean<LeanUser | null>();
            if (!user || !user.password) return null;

            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) return null;

            return {
                id: user._id.toString(),
                name: user.username,
                email: user.email,
                image: user.profilePicture,
                role: user.role || "user",
            };
        },
    }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })
    );
}

export const authOptions: NextAuthOptions = {
    secret: process.env.NEXTAUTH_SECRET,
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    providers,
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider !== "google") return true;
            if (!user.email) return false;

            await connectToDatabase();
            const existing = await User.findOne({ email: user.email });
            if (!existing) {
                await User.create({
                    username: user.name || user.email.split("@")[0],
                    email: user.email,
                    password: "",
                    profilePicture: user.image,
                    role: "user",
                    status: "active",
                    isVerified: new Date(),
                    isOnline: false,
                    conversations: [],
                });
            }

            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                const nextUser = user as { id?: string; role?: Role; image?: string | null };
                if (nextUser.id) token.id = nextUser.id;
                token.role = nextUser.role || token.role || "user";
                if (nextUser.image) token.picture = nextUser.image;
            }

            if (!token.id && token.email) {
                await connectToDatabase();
                const existing = await User.findOne({ email: token.email })
                    .select("_id role profilePicture")
                    .lean<{ _id: { toString(): string }; role?: Role; profilePicture?: string } | null>();

                if (existing) {
                    token.id = existing._id.toString();
                    token.role = existing.role || "user";
                    if (!token.picture && existing.profilePicture) {
                        token.picture = existing.profilePicture;
                    }
                }
            }

            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = String(token.id || "");
                session.user.role = String(token.role || "user");
                if (token.picture && !session.user.image) {
                    session.user.image = token.picture;
                }
            }
            return session;
        },
    },
};
