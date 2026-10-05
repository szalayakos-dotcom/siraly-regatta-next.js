import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sirály Regatta — hamarosan',
  description: 'A Sirály Regatta hamarosan új formában indul. Iratkozz fel, és szólunk, amikor indul.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <link rel="preload" as="image" href="/siraly-hamarosan.webp" />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
