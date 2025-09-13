import { DefaultSession, DefaultUser } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
    interface User extends DefaultUser {
        id: string;
        role: string;
    }

    interface Session {
        user: {
            id: string;
            role: string;
        } & DefaultSession["user"];
        accessToken?: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT extends DefaultJWT {
        id: string;
        role: string;
        picture?: string;
        accessToken?: string;
    }
}