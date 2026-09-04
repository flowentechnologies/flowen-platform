import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Documentation — Flowen Speech Platform',
  description: 'Flowen REST API reference for NHS systems integrators, SLT software vendors, and research partners. Authentication, endpoints, and data schemas.',
};

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  auth: 'user' | 'clinician' | 'admin' | 'public';
  description: string;
  requestSchema?: string;
  responseSchema: string;
  notes?: string;
}

const METHOD_COLORS: Record<Endpoint['method'], string> = {
  GET:    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  POST:   'bg-sky-500/15 text-sky-300 border-sky-500/30',
  PUT:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  PATCH:  'bg-purple-500/15 text-purple-300 border-purple-500/30',
  DELETE: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const AUTH_LABELS: Record<Endpoint['auth'], string> = {
  user:      'User JWT',
  clinician: 'Clinician JWT',
  admin:     'Admin JWT',
  public:    'Public',
};

const ENDPOINT_GROUPS: { title: string; tag: string; endpoints: Endpoint[] }[] = [
  {
    title: 'Authentication',
    tag: 'AUTH',
    endpoints: [
      {
        method: 'POST',
        path: '/auth/v1/token',
        auth: 'public',
        description: 'Exchange email/password or magic link token for a JWT session. Handled by Supabase Auth — see Supabase Auth documentation for full details.',
        responseSchema: `{
  "access_token": "string (JWT)",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "string",
  "user": {
    "id": "uuid",
    "email": "string",
    "role": "authenticated"
  }
}`,
        notes: 'All platform API endpoints require a valid JWT Bearer token in the Authorization header.',
      },
    ],
  },
  {
    title: 'Practice Sessions',
    tag: 'PRACTICE',
    endpoints: [
      {
        method: 'POST',
        path: '/api/practice/sessions',
        auth: 'user',
        description: 'Submit a completed practice session. Triggers programme auto-advance evaluation.',
        requestSchema: `{
  "duration_seconds": number,     // 1–7200 required
  "total_blocks_detected": number, // integer ≥ 0 required
  "stage_id": number | null       // integer ≥ 1 optional
}`,
        responseSchema: `{
  "session": {
    "id": "uuid",
    "user_id": "uuid",
    "duration_seconds": number,
    "total_blocks_detected": number,
    "bpm": number,
    "stage_id": number | null,
    "created_at": "ISO 8601"
  },
  "autoAdvance": {
    "advanced": boolean,
    "newWeek": number | null,
    "weekTitle": string | null,
    "avgBpm": number | null
  }
}`,
        notes: 'Auto-advance only triggers when: (a) sessions_this_week ≥ target, (b) sufficient long sessions (≥90s), and (c) avgBpm ≤ 3.5.',
      },
      {
        method: 'GET',
        path: '/api/practice/sessions',
        auth: 'user',
        description: 'Retrieve the authenticated user\'s practice session history.',
        responseSchema: `{
  "sessions": [
    {
      "id": "uuid",
      "duration_seconds": number,
      "total_blocks_detected": number,
      "bpm": number,
      "stage_id": number | null,
      "created_at": "ISO 8601"
    }
  ]
}`,
      },
      {
        method: 'GET',
        path: '/api/practice/programme',
        auth: 'user',
        description: 'Get the authenticated user\'s current programme state, including current week, targets, and auto-advance eligibility.',
        responseSchema: `{
  "state": {
    "currentWeek": number,
    "week": {
      "week": number,
      "phase": "Foundation | Building | Integration | Transfer | Maintenance",
      "title": "string",
      "stages": number[],
      "targetSessions": number,
      "targetMinutes": number,
      "focus": "string",
      "tip": "string"
    },
    "weekStartedAt": "ISO 8601",
    "completedWeeks": number[],
    "sessionsThisWeek": number,
    "isComplete": boolean,
    "canAdvance": boolean,
    "progressPct": number
  }
}`,
      },
    ],
  },
  {
    title: 'Treatment Plans',
    tag: 'CLINICAL',
    endpoints: [
      {
        method: 'GET',
        path: '/api/user/treatment-plan',
        auth: 'user',
        description: 'Retrieve the authenticated patient\'s active treatment plan, including SLP details.',
        responseSchema: `{
  "plan": {
    "prescribed_stages": number[],
    "sessions_per_week": number,
    "minutes_per_session": number,
    "phase": "string",
    "goals": "string | null",
    "slp_display_name": "string | null",
    "slp_email": "string | null"
  } | null
}`,
      },
      {
        method: 'GET',
        path: '/api/clinician/patients/[patientId]',
        auth: 'clinician',
        description: 'Retrieve session data and treatment plan for a specific patient assigned to the authenticated clinician.',
        responseSchema: `{
  "sessions": [
    {
      "id": "uuid",
      "duration_seconds": number,
      "total_blocks_detected": number,
      "bpm": number,
      "stage_id": number | null,
      "clinician_note": "string | null",
      "created_at": "ISO 8601"
    }
  ],
  "plan": { /* same as /api/user/treatment-plan */ }
}`,
        notes: 'Returns 403 if patientId is not assigned to the authenticated clinician.',
      },
      {
        method: 'POST',
        path: '/api/clinician/patients/[patientId]',
        auth: 'clinician',
        description: 'Add or update a clinician note on a specific patient session.',
        requestSchema: `{
  "session_id": "uuid",
  "note": "string"
}`,
        responseSchema: `{
  "ok": true
}`,
        notes: 'Verifies both clinician–patient assignment and that session_id belongs to patientId. Returns 404 if either check fails.',
      },
    ],
  },
  {
    title: 'Clinical Messaging',
    tag: 'MESSAGING',
    endpoints: [
      {
        method: 'GET',
        path: '/api/messages?with=[userId]',
        auth: 'user',
        description: 'Retrieve the message thread between the authenticated user and another user (must be in an active SLP–patient assignment).',
        responseSchema: `{
  "messages": [
    {
      "id": "uuid",
      "sender_id": "uuid",
      "content": "string",
      "created_at": "ISO 8601",
      "read_at": "ISO 8601 | null"
    }
  ]
}`,
        notes: 'The with= parameter must be a valid UUID. Returns 403 if no active assignment exists between the two users.',
      },
      {
        method: 'POST',
        path: '/api/messages',
        auth: 'user',
        description: 'Send a message to another user (must be in an active SLP–patient assignment).',
        requestSchema: `{
  "to": "uuid",
  "content": "string"
}`,
        responseSchema: `{
  "message": {
    "id": "uuid",
    "sender_id": "uuid",
    "content": "string",
    "created_at": "ISO 8601"
  }
}`,
      },
    ],
  },
  {
    title: 'Reports',
    tag: 'REPORTS',
    endpoints: [
      {
        method: 'GET',
        path: '/api/reports/patient',
        auth: 'user',
        description: 'Generate and stream a PDF progress report for the authenticated patient, covering session history, BPM trends, and programme progress.',
        responseSchema: 'application/pdf binary stream',
        notes: 'Report covers the last 30 days. SLPs can generate reports for assigned patients via /api/reports/patient/[patientId].',
      },
      {
        method: 'GET',
        path: '/api/reports/patient/[patientId]',
        auth: 'clinician',
        description: 'Generate a PDF progress report for a specific patient assigned to the authenticated clinician.',
        responseSchema: 'application/pdf binary stream',
        notes: 'Returns 403 if patientId is not assigned to the authenticated clinician.',
      },
    ],
  },
  {
    title: 'User Profile',
    tag: 'USER',
    endpoints: [
      {
        method: 'GET',
        path: '/api/user/profile',
        auth: 'user',
        description: 'Retrieve the authenticated user\'s profile data.',
        responseSchema: `{
  "profile": {
    "id": "uuid",
    "display_name": "string",
    "email": "string",
    "role": "pwds | clinician | researcher | parent_carer | other",
    "is_admin": boolean,
    "onboarded_at": "ISO 8601",
    "tier": "free | pro | clinical",
    "gdpr_consent_at": "ISO 8601"
  }
}`,
      },
      {
        method: 'POST',
        path: '/api/user/gdpr-erasure',
        auth: 'user',
        description: 'Submit a GDPR Article 17 erasure request. Anonymises PII, deletes voice biomarkers, and records completion in the consent audit log.',
        requestSchema: `{
  "confirm": true
}`,
        responseSchema: `{
  "ok": true,
  "erasedAt": "ISO 8601"
}`,
        notes: 'Irreversible. Retained data (financial records, audit log entries) cannot be erased due to legal obligations.',
      },
    ],
  },
];

function MethodBadge({ method }: { method: Endpoint['method'] }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-black border font-mono ${METHOD_COLORS[method]}`}>
      {method}
    </span>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <MarketingNavbar />

      <main id="main-content" className="flex-1">
        {/* Header */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            TECHNICAL INTEGRATION
          </span>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mt-4">API Reference</h1>
          <p className="text-slate-400 text-sm mt-3 max-w-2xl leading-relaxed">
            REST API documentation for NHS systems integrators, SLT software vendors, and research partners.
            All endpoints require JWT authentication via Supabase Auth.
          </p>
        </section>

        {/* Quick reference */}
        <section className="max-w-4xl mx-auto px-6 pb-12">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white">Base URL & Authentication</h2>
            <div className="font-mono text-xs space-y-3">
              <div>
                <div className="text-slate-400 text-[11px] uppercase tracking-widest mb-1">Base URL</div>
                <code className="text-emerald-400">https://flowen.digital</code>
              </div>
              <div>
                <div className="text-slate-400 text-[11px] uppercase tracking-widest mb-1">Authentication Header</div>
                <code className="text-slate-300">Authorization: Bearer {'<'}access_token{'>'}</code>
              </div>
              <div>
                <div className="text-slate-400 text-[11px] uppercase tracking-widest mb-1">Content Type</div>
                <code className="text-slate-300">Content-Type: application/json</code>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <div className="text-slate-400 text-[11px] uppercase tracking-widest mb-3">Auth Levels</div>
              <div className="flex flex-wrap gap-3 text-xs">
                {(Object.entries(AUTH_LABELS) as [Endpoint['auth'], string][]).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                      key === 'admin' ? 'bg-red-500/15 text-red-300 border-red-500/30' :
                      key === 'clinician' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' :
                      key === 'user' ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' :
                      'bg-slate-700/60 text-slate-400 border-slate-600/50'
                    }`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <div className="text-slate-400 text-[11px] uppercase tracking-widest mb-3">Rate Limits</div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div><span className="text-slate-400">/api routes:</span> <span className="text-slate-200">60 req/min per IP</span></div>
                <div><span className="text-slate-400">Other routes:</span> <span className="text-slate-200">120 req/min per IP</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* Error codes */}
        <section className="max-w-4xl mx-auto px-6 pb-12">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-4 pb-3 border-b border-slate-800">
            HTTP Status Codes
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800">
                  <th className="text-left p-4 text-xs font-mono text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="text-left p-4 text-xs font-mono text-slate-400 uppercase tracking-widest">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {[
                  { code: '200', meaning: 'Success' },
                  { code: '201', meaning: 'Created' },
                  { code: '400', meaning: 'Bad Request — validation error; check request body schema' },
                  { code: '401', meaning: 'Unauthorized — missing or invalid JWT; re-authenticate' },
                  { code: '403', meaning: 'Forbidden — authenticated but insufficient permissions (e.g. accessing another user\'s data)' },
                  { code: '404', meaning: 'Not Found — resource does not exist or is not accessible to caller' },
                  { code: '429', meaning: 'Too Many Requests — rate limit exceeded; back off and retry after 60 seconds' },
                  { code: '500', meaning: 'Internal Server Error — unexpected error; contact hello@flowen.digital' },
                ].map(row => (
                  <tr key={row.code} className="bg-slate-900/30 hover:bg-slate-900/60 transition-colors">
                    <td className="p-4 font-mono text-sm font-bold text-emerald-400">{row.code}</td>
                    <td className="p-4 text-slate-400 text-sm">{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Endpoint groups */}
        {ENDPOINT_GROUPS.map(group => (
          <section key={group.tag} className="border-t border-slate-800/60 max-w-4xl mx-auto px-6 py-12">
            <div className="flex items-center gap-3 mb-8 pb-3 border-b border-slate-800">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                {group.tag}
              </span>
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
                {group.title}
              </h2>
            </div>

            <div className="space-y-6">
              {group.endpoints.map((ep, i) => (
                <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                  {/* Endpoint header */}
                  <div className="flex flex-wrap items-center gap-3 p-5 border-b border-slate-800">
                    <MethodBadge method={ep.method} />
                    <code className="text-sm text-white font-mono font-bold">{ep.path}</code>
                    <span className={`ml-auto text-[10px] font-mono px-2 py-0.5 rounded border ${
                      ep.auth === 'admin' ? 'bg-red-500/15 text-red-300 border-red-500/30' :
                      ep.auth === 'clinician' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' :
                      ep.auth === 'user' ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' :
                      'bg-slate-700/60 text-slate-400 border-slate-600/50'
                    }`}>
                      {AUTH_LABELS[ep.auth]}
                    </span>
                  </div>

                  <div className="p-5 space-y-4">
                    <p className="text-slate-300 text-sm leading-relaxed">{ep.description}</p>

                    {ep.requestSchema && (
                      <div>
                        <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">Request Body</div>
                        <pre className="bg-slate-950 rounded-xl p-4 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed">
                          {ep.requestSchema}
                        </pre>
                      </div>
                    )}

                    <div>
                      <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">Response</div>
                      <pre className="bg-slate-950 rounded-xl p-4 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed">
                        {ep.responseSchema}
                      </pre>
                    </div>

                    {ep.notes && (
                      <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                        <span className="flex-shrink-0 font-bold">Note</span>
                        <span className="leading-relaxed">{ep.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Data schemas */}
        <section className="border-t border-slate-800/60 max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 mb-8 pb-3 border-b border-slate-800">
            Core Data Types
          </h2>
          <div className="space-y-6">
            {[
              {
                name: 'Programme Week',
                schema: `{
  week: number,                  // 1–8
  phase: string,                 // "Foundation" | "Building" | "Integration" | "Transfer" | "Maintenance"
  title: string,
  stages: number[],              // practice stage IDs for this week
  targetSessions: number,
  targetMinutes: number,
  focus: string,                 // clinical focus description
  tip: string                    // practice tip for the user
}`,
              },
              {
                name: 'Practice Session',
                schema: `{
  id: uuid,
  user_id: uuid,
  duration_seconds: number,      // actual session duration
  total_blocks_detected: number, // integer, disfluency event count
  bpm: number,                   // blocks per minute (computed)
  stage_id: number | null,
  clinician_note: string | null, // SLP-entered annotation
  created_at: ISO8601
}`,
              },
              {
                name: 'Treatment Plan',
                schema: `{
  prescribed_stages: number[],
  sessions_per_week: number,
  minutes_per_session: number,
  phase: string,
  goals: string | null,          // clinical goals text
  slp_display_name: string | null,
  slp_email: string | null
}`,
              },
            ].map(schema => (
              <div key={schema.name}>
                <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">
                  {schema.name}
                </div>
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed">
                  {schema.schema}
                </pre>
              </div>
            ))}
          </div>
        </section>

        {/* Integration contact */}
        <section className="border-t border-slate-800/60 max-w-4xl mx-auto px-6 py-16">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-3">NHS & Enterprise Integration</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              For NHS system integrations (EPR, PAS, EMIS, SystmOne), FHIR R4 connectivity, or bespoke
              API access for research, contact our technical team. We provide a full technical specification,
              sandbox environment, and integration support for NHS-contracted organisations.
            </p>
            <a
              href="mailto:hello@flowen.digital?subject=API Integration Enquiry — [Organisation]"
              className="inline-block bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              Technical Integration Enquiry →
            </a>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
