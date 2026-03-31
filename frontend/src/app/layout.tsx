import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/contexts/AuthContext'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { QueryProvider } from '@/lib/query/cache'

export const metadata: Metadata = {
  title: 'WhatsApp Chatbot Platform',
  description: 'Multi-tenant WhatsApp chatbot platform for government and enterprises',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
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
        <SpeedInsights />
      </body>
    </html>
  )
}
