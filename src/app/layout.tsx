import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastProvider } from '@/components/toast';
import { AmbientMist } from '@/components/magicui/ambient-mist';

export const metadata: Metadata = {
  title: 'NexusFlow — Unified Context-Aware Workspace',
  description: 'Ruang kerja terpadu untuk knowledge worker: catatan Markdown, Kanban, Related Context, dan otomasi AI.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F3EE' },
    { media: '(prefers-color-scheme: dark)', color: '#07080C' },
  ],
};

// ?theme=dark|light is persisted before next-themes reads localStorage, so the first paint never flashes
const themeParamScript = `try{var t=new URLSearchParams(location.search).get('theme');if(t==='dark'||t==='light'){localStorage.setItem('theme',t);document.documentElement.setAttribute('data-theme',t);}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Grotesk:wght@500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@700;800;900&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeParamScript }} />
      </head>
      <body className="min-h-screen flex flex-col relative antialiased">
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ToastProvider>
            <AmbientMist />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
