import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const { pathname } = req.nextUrl;
        const token = req.nextauth.token;

        // Logged-in users should not access login/register
        if (token && (pathname === "/login" || pathname === "/register")) {
            return NextResponse.redirect(new URL("/", req.url));
        }

        // Admin-only routes
        if (pathname.startsWith("/admin")) {
            if (!token || token.role !== "admin") {
                return NextResponse.redirect(new URL("/", req.url));
            }
        }

        return NextResponse.next();
    },
    {
        callbacks: {
            authorized({ token, req }) {
                const { pathname } = req.nextUrl;

                // Public routes
                if (
                    pathname === "/login" ||
                    pathname === "/register" ||
                    pathname === "/error"
                ) {
                    return true;
                }

                // All other matched routes require auth
                return !!token;
            },
        },
    }
);

export const config = {
    matcher: [
        /**
         * Pages ONLY — never APIs
         */
        "/login",
        "/register",
        "/",
        "/dashboard/:path*",
        "/profile/:path*",
        "/settings/:path*",
        "/admin/:path*",
    ],
};