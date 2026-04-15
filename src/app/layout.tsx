// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/modules/auth/context/auth-context";
import { ThemeProvider } from '@/components/theme/context/theme-context';
import { UserProvider } from '@/modules/users/context/user-context';
import { SystemProvider } from '@/modules/testConfig/context/SystemContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Network Testing Portal",
  description: "Network Testing and Configuration Portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body suppressHydrationWarning>
        <ThemeProvider>
          <TooltipProvider>
            <SystemProvider>
              <UserProvider>
                <AuthProvider>
                  <div className={`${inter.variable} font-sans antialiased`}>
                    {children}
                  </div>
                  <Toaster />
                </AuthProvider>
              </UserProvider>
            </SystemProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}