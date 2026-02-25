import type { Metadata } from 'next'
import { Inter } from "next/font/google";
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/contexts/AuthContext'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4500,
              style: {
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                background: '#0F172A',
                color: '#F8FAFC',
                fontSize: '13px',
                fontWeight: 500,
                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.20)',
              },
              success: {
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#ECFDF5',
                },
              },
              error: {
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#FEF2F2',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
