import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "./db";
import { User } from "@/models/User";
import { MongoDBAdapter } from "@next-auth/mongodb-adapter";
import clientPromise from "./mongo";


export const authOptions: NextAuthOptions = {
    adapter: MongoDBAdapter(clientPromise),
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Missing email or password");
                }

                await connectToDatabase();
                const user = await User.findOne({ email: credentials.email });

                if (!user) {
                    throw new Error("User not found");
                }

                const isValid = await bcrypt.compare(
                    credentials.password,
                    user.password
                );

                if (!isValid) {
                    throw new Error("Invalid password");
                }

                return {
                    id: user._id.toString(),
                    email: user.email,
                    name: user.username,
                    image: user.profilePicture,
                    role: user.role, // ✅ send role here
                };
            },
        }),

        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),

        AppleProvider({
            clientId: process.env.APPLE_ID!,
            clientSecret: process.env.APPLE_SECRET!,
        }),
    ],

    callbacks: {
        async signIn({ user, account, profile }) {
            await connectToDatabase();

            if (account?.provider === "google") {
                let dbUser = await User.findOne({ email: profile?.email });

                if (!dbUser) {
                    dbUser = await User.create({
                        email: user.email,
                        username: user.name,
                        profilePicture: user.image,
                        role: "user", //  default role for new Google users
                    });
                }

                user.id = dbUser._id.toString();
                user.role = dbUser.role; //  ensure we attach DB role
            }

            if (account?.provider === "apple") {
                // Same logic as Google if you want role handling here
            }

            return true;
        },

        async jwt({ token, user }) {
            if (user) {
                token.id = user.id || token.id;
                token.image = user.image || token.image;
                token.role = user.role || token.role; // carry role forward
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                //session.user.id = token.id as string;
                session.user.image =
                    (token.picture as string) || session.user.image || "";
                session.user.role = token.role as string; // ✅ role available in session
                session.accessToken = token.accessToken as string;
            }
            return session;
        },
    },

    pages: {
        signIn: "/login",
        error: "/login",
    },

    session: {
        strategy: "jwt",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24,  // refresh every 24h
    },
    // cookies: {
    //     sessionToken: {
    //         name: "session",
    //         options: {
    //             httpOnly: true,
    //             secure: process.env.NODE_ENV === "production",
    //             sameSite: "lax",
    //             path: "/",
    //         }
    //     }
    // },

    secret: process.env.NEXTAUTH_SECRET,
};