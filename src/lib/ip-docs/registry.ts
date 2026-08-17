// ── IP Document Registry ──────────────────────────────────────────────────────
// All internal IP documents. Each entry maps to a slug and renders in
// /admin/ip-docs/[slug]/page.tsx (assertAdmin gated).
//
// SECURITY: these docs are admin-only. Do NOT export from any public route.
// ─────────────────────────────────────────────────────────────────────────────

export interface IpDocMeta {
  slug:      string;
  title:     string;
  category:  string;
  type:      'legal-template' | 'policy' | 'audit-report' | 'checklist' | 'procedure' | 'clinical-safety-case' | 'regulatory-application';
  status:    'draft' | 'internal-approved' | 'requires-legal-review';
  auditSlug: string | null;  // matches title in ip_audit_items for linking
  version:   string;
  date:      string;
}

export const IP_DOCS: IpDocMeta[] = [
  // Regulatory & Clinical Safety
  { slug: 'dcb0129-clinical-safety-case',  title: 'DCB0129 Clinical Safety Case Report',            category: 'regulatory', type: 'clinical-safety-case',    status: 'draft', auditSlug: null, version: '1.0', date: 'August 2026' },
  { slug: 'seis-advance-assurance',        title: 'SEIS Advance Assurance Application — HMRC',      category: 'regulatory', type: 'regulatory-application',  status: 'draft', auditSlug: null, version: '1.0', date: 'August 2026' },
  // Contracts
  { slug: 'founder-ip-assignment-deed',    title: 'Founder IP Assignment Deed',                  category: 'contracts',     type: 'legal-template',   status: 'requires-legal-review', auditSlug: 'Founder IP Assignment Deed',               version: '1.0', date: 'August 2026' },
  { slug: 'employment-ip-clause',          title: 'Employment Contracts — IP Clause Addendum',   category: 'contracts',     type: 'legal-template',   status: 'requires-legal-review', auditSlug: 'Employment Contracts — IP Clauses',        version: '1.0', date: 'August 2026' },
  { slug: 'adviser-ip-agreement',          title: 'Adviser / Consultant IP Agreement Template',  category: 'contracts',     type: 'legal-template',   status: 'requires-legal-review', auditSlug: 'Adviser / Advisor Agreements',             version: '1.0', date: 'August 2026' },
  // AI Models
  { slug: 'asr-ip-assignment-brief',       title: 'ASR Model IP Assignment Brief',               category: 'ai_models',     type: 'audit-report',     status: 'draft',                 auditSlug: 'ASR Model IP Assignment from Founders',    version: '1.0', date: 'August 2026' },
  { slug: 'training-data-audit',           title: 'AI Training Dataset IP Verification Report',  category: 'ai_models',     type: 'audit-report',     status: 'draft',                 auditSlug: 'AI Training Dataset IP Verification',      version: '1.0', date: 'August 2026' },
  { slug: 'licence-compliance-report',     title: 'Open-Source Dependency Licence Report',       category: 'ai_models',     type: 'audit-report',     status: 'internal-approved',     auditSlug: 'Open-Source Component Audit',              version: '1.0', date: 'August 2026' },
  { slug: 'model-version-control-policy',  title: 'AI Model Version Control & Audit Policy',     category: 'ai_models',     type: 'policy',           status: 'draft',                 auditSlug: 'Model Version Control & Checksums',        version: '1.0', date: 'August 2026' },
  // Software
  { slug: 'source-code-assignment',        title: 'Contractor Source Code IP Assignment',        category: 'software',      type: 'legal-template',   status: 'requires-legal-review', auditSlug: 'Flowen Platform Source Code Assignment',   version: '1.0', date: 'August 2026' },
  { slug: 'copyright-registration-guide',  title: 'Software Copyright Registration Guide',       category: 'software',      type: 'checklist',        status: 'draft',                 auditSlug: 'Software Copyright Registration',          version: '1.0', date: 'August 2026' },
  { slug: 'dependency-licence-report',     title: 'npm Dependency Licence Compliance Report',    category: 'software',      type: 'audit-report',     status: 'internal-approved',     auditSlug: 'Dependency Licence Compliance Scan',       version: '1.0', date: 'August 2026' },
  // Trade Secrets
  { slug: 'trade-secret-policy',           title: 'Flowen Trade Secret Protection Policy',       category: 'trade_secrets', type: 'policy',           status: 'draft',                 auditSlug: 'Disfluency Algorithm Trade Secret Protection', version: '1.0', date: 'August 2026' },
  { slug: 'nda-template',                  title: 'Mutual Non-Disclosure Agreement Template',    category: 'trade_secrets', type: 'legal-template',   status: 'requires-legal-review', auditSlug: 'Employee & Contractor NDA Coverage',       version: '1.0', date: 'August 2026' },
  // Data & Datasets
  { slug: 'dataset-catalogue',             title: 'Proprietary Disfluent Speech Dataset Catalogue', category: 'data_datasets', type: 'audit-report',  status: 'draft',                 auditSlug: 'Proprietary Disfluent Speech Dataset',     version: '1.0', date: 'August 2026' },
  { slug: 'gdpr-consent-framework',        title: 'Session Data GDPR Consent & Processing Framework', category: 'data_datasets', type: 'policy',      status: 'draft',                 auditSlug: 'User-Consented Session Data Policy',       version: '1.0', date: 'August 2026' },
  { slug: 'synthetic-data-rights-policy',  title: 'Synthetic Data Generation Rights Policy',    category: 'data_datasets', type: 'policy',           status: 'draft',                 auditSlug: 'Synthetic Data Generation Rights',         version: '1.0', date: 'August 2026' },
  // Patents
  { slug: 'disfluency-invention-disclosure', title: 'Invention Disclosure — Disfluency Detection Method', category: 'patents', type: 'checklist',   status: 'draft',                 auditSlug: 'Disfluency Detection Method Patent',       version: '1.0', date: 'August 2026' },
  { slug: 'waveform-prior-art-brief',      title: 'Waveform Visualisation — Prior Art Assessment Brief', category: 'patents',  type: 'audit-report', status: 'draft',                 auditSlug: 'Waveform Visualisation Method',             version: '1.0', date: 'August 2026' },
  // Trademarks
  { slug: 'trademark-filing-tracker',      title: 'Flowen Trademark Portfolio Filing Tracker',   category: 'trademarks',    type: 'procedure',        status: 'draft',                 auditSlug: null,                                       version: '1.0', date: 'August 2026' },
];

export function getDoc(slug: string): IpDocMeta | undefined {
  return IP_DOCS.find(d => d.slug === slug);
}

export const STATUS_BADGE: Record<IpDocMeta['status'], string> = {
  'draft':                  'bg-amber-500/10 border-amber-500/30 text-amber-400',
  'internal-approved':      'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  'requires-legal-review':  'bg-rose-500/10 border-rose-500/30 text-rose-400',
};

export const TYPE_LABEL: Record<IpDocMeta['type'], string> = {
  'legal-template':       '⚖️ Legal Template',
  'policy':               '📋 Policy',
  'audit-report':         '🔍 Audit Report',
  'checklist':            '✅ Checklist',
  'procedure':            '🔄 Procedure',
  'clinical-safety-case':    '🏥 Clinical Safety Case',
  'regulatory-application':  '📨 Regulatory Application',
};
