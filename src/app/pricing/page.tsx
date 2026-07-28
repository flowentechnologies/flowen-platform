import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import PricingSection from '@/components/Pricing';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Flowen Speech Platform',
  description: 'Flowen subscription tiers for individuals, clinicians, and institutional/NHS procurement. Founding Member, Standard, and Government rates.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <MarketingNavbar />
      <main className="flex-1">
        <PricingSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
