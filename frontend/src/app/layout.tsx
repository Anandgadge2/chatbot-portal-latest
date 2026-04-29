import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/lib/query/cache";

export const metadata: Metadata = {
  title: {
    default: "PugArch Connect Dashboard",
    template: "%s | PugArch Connect",
  },
  description:
    "Multi-tenant grievance and appointment dashboard for company, department, and platform administrators.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 1000,
                success: {
                  duration: 1000,
                },
                error: {
                  duration: 2000,
                },
              }}
            />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
