import './globals.css'
import type { Metadata } from 'next'

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
      <body>{children}</body>
    </html>
  )
}