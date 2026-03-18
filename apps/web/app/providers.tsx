'use client'

import { ThemeProvider } from "@/providers/theme-provider";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import { UserProvider } from "@/context/UserContext";
import { SocketProvider } from "@/providers/socket-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute='class' defaultTheme='system' enableSystem disableTransitionOnChange>
      <SessionProvider>
        <UserProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
          <Toaster />
        </UserProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}