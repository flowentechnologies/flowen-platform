import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import PricingSection from '@/components/Pricing';
import { JsonLd } from '@/components/JsonLd';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Flowen Speech Platform',
  description: 'Flowen subscription tiers for individuals, clinicians, and institutional/NHS procurement. Founding Member, Standard, and Government rates.',
  alternates: {
    canonical: '/pricing',
  },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://flowen.digital' },
          { '@type': 'ListItem', 'position': 2, 'name': 'Pricing', 'item': 'https://flowen.digital/pricing' },
        ],
      }} />
      <MarketingNavbar />
      <main className="flex-1">
        <PricingSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
