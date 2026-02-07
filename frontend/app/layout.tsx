import './globals.css';
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Makes it feel like a native app (no pinch-zoom)
  themeColor: '#05070f',
};

export const metadata: Metadata = {
  title: 'Mercosur News',
  description: 'Real-time intelligence from Uruguay, Argentina, Brazil, Paraguay, and Bolivia.',
  manifest: '/manifest.json', // LINKS YOUR NEW MANIFEST
  icons: {
    // 1. The little icon in the browser tab (Favicon)
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌎</text></svg>',
    // 2. The icon for Apple devices
    apple: '/icon.png', 
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mercosur News',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#05070f' }}>
        {children}
      </body>
    </html>
  );
}