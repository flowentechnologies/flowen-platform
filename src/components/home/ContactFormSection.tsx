'use client';

import { useState, useTransition } from 'react';
import { submitContactForm, type FormState } from '@/app/actions/submit-form';
import { LegalPoliciesModal } from '@/components/LegalPoliciesModal';

export default function ContactFormSection() {
  const [isPending, startTransition] = useTransition();
  const [formState,    setFormState]    = useState<FormState>({ success: false, message: '' });
  const [selectedTier, setSelectedTier] = useState<string>('Standard Access (£39.99/mo)');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalTab,     setModalTab]     = useState<'terms' | 'privacy' | 'dcb0129'>('terms');

  const openLegal = (tab: 'terms' | 'privacy' | 'dcb0129') => {
    setModalTab(tab);
    setModalOpen(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set('tier', selectedTier);
    startTransition(async () => {
      const result = await submitContactForm(formState, formData);
      setFormState(result);
    });
  };

  return (
    <section id="contact" className="py-20 px-6 max-w-4xl mx-auto border-t border-slate-800/60">
      <div className="bg-[#0A0D14] border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white">Get in touch</h2>
          <p className="text-slate-400 mt-2 text-sm">
            Questions, Access to Work enquiries, NHS commissioning, or just want to try Flowen — our team responds at{' '}
            <strong className="text-emerald-400">hello@flowen.digital</strong>.
          </p>
        </div>

        {formState.success ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
            <div className="text-3xl">✓</div>
            <h3 className="text-xl font-bold text-emerald-400">Submission Received</h3>
            <p className="text-slate-300 text-sm">{formState.message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="selected-tier" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Selected Tier</label>
              <input
                id="selected-tier"
                type="text"
                value={selectedTier}
                readOnly
                className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-emerald-400 font-semibold text-sm cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Full Name *</label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Jane Smith"
                  className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
                />
                {formState.errors?.name && <p className="text-red-400 text-xs mt-1">{formState.errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address *</label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="jane@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
                />
                {formState.errors?.email && <p className="text-red-400 text-xs mt-1">{formState.errors.email}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Organization / Program (Optional)</label>
              <input
                name="role"
                type="text"
                placeholder="Access to Work / NHS ICB / Private Practice"
                className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Inquiry / Requirements *</label>
              <textarea
                name="message"
                rows={4}
                required
                placeholder="Describe your inquiry or institutional seat block requirement..."
                className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
              />
              {formState.errors?.message && <p className="text-red-400 text-xs mt-1">{formState.errors.message}</p>}
            </div>

            <p className="text-xs text-slate-500">
              By submitting this form, you acknowledge that your details will be processed in accordance with our{' '}
              <button type="button" onClick={() => openLegal('privacy')} className="text-emerald-400 underline">
                Privacy Policy &amp; UK GDPR
              </button>.
            </p>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
            >
              {isPending ? 'Dispatching to hello@flowen.digital...' : 'Submit Inquiry'}
            </button>
          </form>
        )}
      </div>

      <LegalPoliciesModal
        isOpen={modalOpen}
        initialTab={modalTab}
        onClose={() => setModalOpen(false)}
      />
    </section>
  );
}
