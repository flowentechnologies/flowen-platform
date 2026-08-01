import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Telemetry | Flowen',
  robots: { index: false, follow: false },
};

export default function TelemetryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
