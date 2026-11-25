import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { assets, siteConfig } from '@/config/site';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  robots: { index: false, follow: false }, // internal tool
};

export const viewport: Viewport = {
  themeColor: '#047857',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <link rel="preload" href={assets.fonts.regular} as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href={assets.fonts.bold} as="font" type="font/ttf" crossOrigin="anonymous" />
      </head>
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
