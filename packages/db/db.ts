import mongoose, { Mongoose } from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;

// Extend NodeJS global type
declare global {
    var mongooseCache: {
        conn: Mongoose | null;
        promise: Promise<Mongoose> | null;
    };
}

// Initialize global cache if not present
global.mongooseCache = global.mongooseCache || { conn: null, promise: null };

const cached = global.mongooseCache;

export async function connectToDatabase(): Promise<Mongoose> {
    if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable in your .env file");
}
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        const options = {
            bufferCommands: false,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
        };

        cached.promise = mongoose.connect(MONGODB_URI, options);
    }

    try {
        cached.conn = await cached.promise;
    } catch (err) {
        cached.promise = null;
        throw err;
    }

    return cached.conn;
}
// lib/db.ts (or wherever you keep DB helimport { connect } fropers)

import { User } from "@/models/User";// Path to your user model

export async function getUserFromDB(email: string) {
    try {
        await connectToDatabase(); // Ensure DB connection

        const user = await User.findOne({ email });

        if (!user) {
            throw new Error('User not found');
        }

        return {
            id: user._id.toString(),
            name: user.username,
            email: user.email,
            image: user.profilePicture,
            role: user.role,
        };
    } catch (error) {
        console.error('Error fetching user from DB:', error);
    }
}
