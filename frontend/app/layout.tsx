import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AniMind – AI-Powered Animation Platform',
  description: 'Create stunning educational animations with AniMind AI.',
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
