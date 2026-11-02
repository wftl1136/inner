import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Onest, Unbounded } from 'next/font/google';
import './globals.css';

// Шрифты бренда DevFlow: Unbounded — заголовки, Onest — интерфейс, JetBrains Mono — время и счётчики
const display = Unbounded({ subsets: ['latin', 'latin-ext', 'cyrillic'], weight: ['500', '600'], variable: '--f-display', display: 'swap' });
const ui = Onest({ subsets: ['latin', 'latin-ext', 'cyrillic'], weight: ['400', '500', '600'], variable: '--f-ui', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext', 'cyrillic'], weight: ['400', '500'], variable: '--f-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'inner',
  description: 'Только твои люди',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'inner',
    statusBarStyle: 'black-translucent'
  },
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }]
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2F2F2' },
    { media: '(prefers-color-scheme: dark)', color: '#050505' }
  ]
};

const themeBoot = `try{var t=localStorage.getItem('inner.theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='dark';}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
