
import mongoose from "mongoose";


const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
    throw new Error("please define mongodb_uri is env file veriables")
}

let cached = global.mongoose
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null }
}

export async function connectToDatabase() {
    if (cached.conn) {
        return cached.conn
    }
    if (!cached.promise) {
        const opctions = {
            bufferCommands: true,
            maxPoolSize: 10,

        }
        mongoose
            .connect(MONGODB_URI, opctions)
            .then(() => mongoose.connection)
    }
    try {
        cached.conn = await cached.promise
    } catch (error) {
        cached.promise = null
        throw error

    }
    return cached.conn
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
