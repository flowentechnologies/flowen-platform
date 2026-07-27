'use client';

import React, { useState } from 'react';

type LegalTab = 'terms' | 'privacy' | 'dcb0129';

interface Props {
  isOpen: boolean;
  initialTab?: LegalTab;
  onClose: () => void;
}

export function LegalPoliciesModal({ isOpen, initialTab = 'terms', onClose }: Props) {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-[#0A0D14] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#121624]">
          <h2 className="text-xl font-semibold text-white">Legal &amp; Compliance Governance</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-[#0E121E]">
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'terms'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Terms of Service
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'privacy'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Privacy Policy &amp; UK GDPR
          </button>
          <button
            onClick={() => setActiveTab('dcb0129')}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'dcb0129'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            DCB0129 Clinical Safety Statement
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm leading-relaxed">
          {activeTab === 'terms' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">1. Master Subscription Agreement</h3>
              <p>
                This Binding Terms of Service Agreement (&quot;Agreement&quot;) governs the access to and use of software, neural models, and clinical telemetry services provided under the Flowen Group (&quot;Flowen Technologies&quot;, &quot;Vocali&quot;, &quot;we&quot;, &quot;us&quot;). By accessing or utilizing the platform, you agree to be bound by these terms.
              </p>

              <h3 className="text-lg font-bold text-white">2. Commercial &amp; Public Sector Billing</h3>
              <p>
                Standard Consumer Tiers are billed monthly at £39.90/month. Institutional and Public Sector Contracts (including Access to Work, NHS Integrated Care Boards, and DSA block allocations) are billed annually in advance at £79.99/month (£959.88/year per seat). Block seat allocations are non-refundable after activation of the license key.
              </p>

              <h3 className="text-lg font-bold text-white">3. Intellectual Property Moat</h3>
              <p>
                All neural weights, acoustic disfluency feature extraction models, viseme alignment engines, and training pipelines remain the exclusive intellectual property of Flowen Group HoldCo. Users retain rights to their personal voice recordings, subject to the consented telemetry license granted for model fine-tuning.
              </p>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">1. UK GDPR &amp; HIPAA Compliance</h3>
              <p>
                Flowen complies strictly with the UK Data Protection Act 2018, UK GDPR, and international health data protection standards. Audio streams processed during practice sessions are processed on secure edge compute nodes.
              </p>

              <h3 className="text-lg font-bold text-white">2. Consented Telemetry &amp; Model Training</h3>
              <p>
                Users who opt in to telemetry allow Flowen to extract anonymized acoustic feature vectors and audio diffs (<code className="text-xs bg-slate-900 px-1 py-0.5 rounded">diffs/user_id/session_id.wav</code>) stored in encrypted Cloudflare R2 repositories. No personally identifiable information (PII) is attached to training audio diffs. Users may revoke consent at any time in account settings.
              </p>

              <h3 className="text-lg font-bold text-white">3. Data Controller Contact</h3>
              <p>
                For data protection inquiries or to exercise Right to Be Forgotten under UK GDPR, contact our Data Protection Officer at <strong>flowenspeech@outlook.com</strong>.
              </p>
            </div>
          )}

          {activeTab === 'dcb0129' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">1. Clinical Safety Officer (CSO) Sign-off</h3>
              <p>
                Flowen is compliant with NHS Digital DCB0129 clinical risk management standards for Health IT Systems. The software is designed as an assistive speech coordination tool and viseme alignment coach.
              </p>

              <h3 className="text-lg font-bold text-white">2. Intended Clinical Use Statement</h3>
              <p>
                Flowen is intended to supplement speech therapy, vocal onset training, and real-time biofeedback. It is not a diagnostic medical device under UK MDR 2002. Clinical supervision remains under the jurisdiction of the qualified Speech and Language Therapist (SLT) or healthcare professional.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-800 bg-[#121624]">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors"
          >
            I Accept &amp; Close
          </button>
        </div>

      </div>
    </div>
  );
}
