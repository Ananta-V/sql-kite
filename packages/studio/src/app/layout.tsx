import './globals.css'
import type { Metadata } from 'next'
import ToastProvider from '@/components/ToastProvider'

export const metadata: Metadata = {
  title: 'Sql Kite',
  description: 'Local SQLite database management platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <ToastProvider />
      </body>
    </html>
  )
}