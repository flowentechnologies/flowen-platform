import type { Metadata } from 'next';
import './globals.css';
import CookieConsent from '@/components/CookieConsent';

export const metadata: Metadata = {
  title: 'Flowen — Retraining the Brain to Speak Freely',
  description: 'AI Speech Coordination for School, Workplace & Daily Life. Sub-80ms real-time vocal retraining engine.',
  metadataBase: new URL('https://flowen.digital'),
  openGraph: {
    title: 'Flowen — AI Speech Coordination',
    description: 'Every word gets there. Sub-80ms real-time vocal retraining and clinical supervision platform.',
    url: 'https://flowen.digital',
    siteName: 'Flowen',
    images: [
      {
        url: '/assets/images/flowen-hero-banner.jpg',
        width: 1200,
        height: 630,
        alt: 'Flowen AI Speech Coordination Platform',
      },
    ],
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flowen — AI Speech Coordination',
    description: 'Every word gets there. Sub-150ms real-time vocal retraining.',
    images: ['/assets/images/flowen-hero-banner.jpg'],
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
