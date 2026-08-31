import type { Metadata, Viewport } from 'next'
import { Inter, Bebas_Neue, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import SessionProvider from '@/components/SessionProvider'
import { ThemeProvider } from '@/components/ThemeContext'
import ConfirmProvider from '@/components/ConfirmProvider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'BioMax',
  description: "Do'kon boshqaruv tizimi — BioMax",
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon-32.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BioMax',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#161210',
}

// Sahifa render bo'lishidan oldin .dark klassini sinxron o'rnatadi —
// aks holda saqlangan tanlov bir lahza yaltirab, keyin o'zgarib ketadi (FOUC).
// Standart — yorug' (qizil-oq brend) uslub.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${inter.variable} ${bebasNeue.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased font-sans">
        <ThemeProvider>
          <SessionProvider>
            <ConfirmProvider>
              {children}
              <Toaster
                richColors
                position="top-right"
                toastOptions={{
                  style: { fontFamily: 'Inter, sans-serif' },
                }}
              />
            </ConfirmProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
