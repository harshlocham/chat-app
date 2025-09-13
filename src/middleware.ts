import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const { pathname } = req.nextUrl;
        const token = req.nextauth.token;

        // If user logged in and tries to visit /login or /register → redirect home
        if (token) {
            if (pathname === "/login" || pathname === "/register") {
                return NextResponse.redirect(new URL("/", req.url));
            }
        } else {
            // If not logged in, block access to protected routes
            if (
                pathname.startsWith("/dashboard") ||
                pathname.startsWith("/profile") ||
                pathname.startsWith("/settings") ||
                pathname.startsWith("/admin")
            ) {
                return NextResponse.redirect(new URL("/login", req.url));
            }
        }

        //  Admin-only check
        if (pathname.startsWith("/admin")) {
            if (token?.role !== "admin") {
                return NextResponse.redirect(new URL("/", req.url));
            }
        }

        return NextResponse.next();
    },
    {
        callbacks: {
            authorized({ req, token }) {
                const { pathname } = req.nextUrl;

                //  Always allow NextAuth API
                if (pathname.startsWith("/api/auth")) return true;

                // Allow unauthenticated access to login/register
                if (pathname === "/login" || pathname === "/register") return true;

                //  For all other routes → require auth
                return !!token;
            },
        },
    }
);

export const config = {
    matcher: [
        // Public
        "/login",
        "/register",
        "/error",

        // Protected
        "/dashboard/:path*",
        "/profile/:path*",
        "/settings/:path*",
        "/admin/:path*",
        "/admin",
        "/admin/users/:path*",
        "/admin/settings/:path*",

        // API
        "/api/:path*",

        // Catch-all (exclude static files)
        "/((?!_next/static|_next/image|favicon.ico|public/).*)",
    ],
};