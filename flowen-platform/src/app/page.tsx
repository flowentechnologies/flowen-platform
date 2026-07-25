import React from 'react';
import MainNavbar from '@/components/MainNavbar';
import PricingSection from '@/components/Pricing';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <MainNavbar />
      <main className="flex-1">
        <PricingSection />
      </main>
    </div>
  );
}
