import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter_Tight } from 'next/font/google';
import { siteUrl } from '@/lib/env';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['opsz', 'SOFT', 'WONK'],
  display: 'swap',
});

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'Sofa Factory Outlet | Sofas in Sri Lanka at Factory Prices',
    template: '%s | Sofa Factory Outlet',
  },
  description:
    'Sofas, sofa sets and furniture made in our own Colombo workshop and sold without a middleman. Visit the showroom to see and sit on every piece.',
  applicationName: 'Sofa Factory Outlet',
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#f3efe8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-LK" className={`${fraunces.variable} ${interTight.variable}`}>
      <body>{children}</body>
    </html>
  );
}
