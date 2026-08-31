import type { Metadata, Viewport } from 'next'
// Google Fonts'ni build vaqtida internetdan yuklab olish (next/font/google)
// ba'zi tarmoqlarda IPv6 orqali osilib qolib, dev serverni sekinlashtirar edi —
// shuning uchun fontlar lokal paket (@fontsource) orqali, internetga
// bog'liqsiz self-hosted qilib ulangan.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/bebas-neue/400.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './globals.css'
import { Toaster } from 'sonner'
import SessionProvider from '@/components/SessionProvider'
import { ThemeProvider } from '@/components/ThemeContext'
import ConfirmProvider from '@/components/ConfirmProvider'

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
    <html lang="uz" suppressHydrationWarning>
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
