import { NextAuthOptions } from "next-auth";
import { connectToDatabase, getUserFromDB } from "./db";
import { User } from "@/models/User";
import bcrypt from "bcryptjs"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
//import { MongoDBAdapter } from "@next-auth/mongodb-adapter";
// The correct package name is "@next-auth/mongodb-adapter" (not "@next-auth/mongodb-").
// To install, run: npm install @next-auth/mongodb-adapter
// If you don't need the adapter, you can remove this import.



export const authOptions: NextAuthOptions = {

    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "password", type: "password" },
            },
            async authorize(credentials) {

                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Missing email or password")
                }
                try {
                    await connectToDatabase();
                    const user = await User.findOne({ email: credentials?.email })
                    if (!user) {
                        throw new Error("User not found")
                    }
                    const isvalid = await bcrypt.compare(
                        credentials.password,
                        user.password
                    )
                    if (!isvalid) {
                        throw new Error("wrong password")
                    }
                    return {
                        id: user._id!.toString(),
                        email: user.email
                    }
                } catch (error) {
                    console.error("Auth error: ", error)
                    throw error
                }
            }
        }),
        AppleProvider({
            clientId: process.env.APPLE_ID!,
            clientSecret: process.env.APPLE_SECRET!,
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!
        })
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (account && account.provider === "google") {
                await connectToDatabase();
                // Check if user already exists
                const existingUser = await User.findOne({ email: profile?.email });
                if (!existingUser) {
                    // Create a new user
                    const newUser = new User({

                        email: user.email,
                        username: user.name,
                        profilePicture: user.image
                    });
                    await newUser.save();
                }
                return true;
            }
            return true;
        },
        // async redirect({ url, baseUrl }) {
        //         // Allows relative callback URLs
        //         if (url.startsWith("/")) return new URL(url, baseUrl).toString();
        //        // Allows absolute URLs
        //         else if (new URL(url).origin === baseUrl) return url;
        //         // Prevents redirecting to other sites
        //         return baseUrl;
        //     },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                const dbUser = await getUserFromDB(user.email!)
                if (dbUser) {
                    token.picture = dbUser.image;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                // if (session.user.email !== user.email) {
                session.accessToken = token.accessToken;
                session.user.image = token.image as string;
                //session.user.id = token.id as string;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
        error: "/login"
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60,
    },
    secret: process.env.NEXTAUTH_SECRET
}