import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Chat App",
  description: "A real-time chat application built with Next.js, Socket.IO, and MongoDB.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning >
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}