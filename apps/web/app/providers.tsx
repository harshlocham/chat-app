'use client'

import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { UserProvider } from "@/context/UserContext";
import { SocketProvider } from "@/providers/socket-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute='class' defaultTheme='system' enableSystem disableTransitionOnChange>
      <UserProvider>
        <SocketProvider>
          {children}
        </SocketProvider>
        <Toaster />
      </UserProvider>
    </ThemeProvider>
  );
}