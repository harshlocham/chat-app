import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Middleware to protect routes based on authentication
export default withAuth(
    function middleware(req) {
        const { pathname } = req.nextUrl;
        const token = req.nextauth.token;

        // Redirect logged-in users from /login and /register pages
        if (token) {
            if (pathname === "/login" || pathname === "/register") {
                return NextResponse.redirect(new URL("/", req.url)); // or "/"
            }
        } else {
            // Redirect unauthenticated users to the login page when trying to access protected routes
            if (
                //pathname.startsWith("/register") ||
                pathname.startsWith("/dashboard") ||
                pathname.startsWith("/profile") ||
                pathname.startsWith("/settings") ||
                pathname.startsWith("/admin")
            ) {
                return NextResponse.redirect(new URL("/login", req.url));
            }
        }

        // If the user is trying to access public routes, continue as normal
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized({ req, token }) {
                const { pathname } = req.nextUrl;

                // Allow unauthenticated access to auth, login, and register routes
                if (
                    pathname.startsWith("/api/auth") ||
                    pathname === "/login" ||
                    pathname === "/register"
                ) {
                    return true;
                }

                // Allow unauthenticated access to home and public videos API
                // if (pathname === "/" || pathname === "/api/videos") {
                //     return true;
                // }

                // Require authentication for all other routes
                return !!token;
            },
        },
    }
);

export const config = {
    matcher: [
        // Publicly accessible routes
        "/login",
        "/register",
        "/error",

        // Protected routes
        "/dashboard/:path*",
        "/profile/:path*",
        "/settings/:path*",
        "/api/:path*",
        "/admin/:path*",
        "/admin",
        "/admin/users/:path*",
        "/admin/settings/:path*",

        // Catch-all: protect all other routes except static files and public assets
        "/((?!_next/static|_next/image|favicon.ico|public/).*)",
    ],
};
