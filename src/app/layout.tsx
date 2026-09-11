// app/layout.tsx
import type { Metadata } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/modules/auth/context/auth-context";
import { ThemeProvider } from '@/components/theme/context/theme-context';
import { UserProvider } from '@/modules/users/context/user-context';
import { SystemProvider } from '@/modules/testConfig/context/SystemContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// Simnovus type pairing, shared with SimQA and the Simnovator GUI: Poppins for
// copy, JetBrains Mono for figures, ports, IDs and the uppercase micro-labels.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: "SimTool",
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
      {/* Font classes live on <body> so portaled UI (dialogs, toasts,
          dropdowns) inherits them — an inner div misses portals, and the
          globals.css body font-family invalidates when the font variable is
          undefined at that level (serif fallback). */}
      <body
        className={`${poppins.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <TooltipProvider>
            <SystemProvider>
              <UserProvider>
                <AuthProvider>
                  <div>
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
