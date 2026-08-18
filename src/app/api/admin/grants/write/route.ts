import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { getAnthropicClient, requireAnthropicKey } from '@/lib/anthropic';
import { adminDb as db } from '@/lib/supabase/admin';

// ── DB client ──────────────────────────────────────────────────────────────────

// ── Types ──────────────────────────────────────────────────────────────────────

interface GrantWriteRequest {
  action:    string;
  grant_id:  string;
  section:   string;
  context?:  string;
}

interface FlowenData {
  userCount:         number;
  sessionCount:      number;
  avgDurationSecs:   number | null;
  nhsCount:          number;
  nhsMostAdvanced:   string | null;
  roundType:         string | null;
  targetRaisePence:  number | null;
  ipAssetCount:      number;
}

// ── Grant type label ───────────────────────────────────────────────────────────

function grantTypeLabel(gt: string): string {
  const map: Record<string, string> = {
    sbri:        'SBRI Healthcare',
    innovate_uk: 'Innovate UK',
    nihr:        'NIHR i4i',
    wellcome:    'Wellcome Trust',
    horizon:     'EU Horizon',
    seis_eis:    'SEIS / EIS',
    private:     'Private Foundation',
    other:       'Other',
  };
  return map[gt] ?? gt;
}

// ── Section prompts ────────────────────────────────────────────────────────────

function buildPrompt(
  section:   string,
  grantName: string,
  grantType: string,
  data:      FlowenData,
  amount:    number | null,
  context:   string | undefined,
): string {
  const grantLabel   = grantTypeLabel(grantType);
  const amountFormatted = amount != null
    ? `£${Math.round(amount / 100).toLocaleString('en-GB')}`
    : 'undisclosed';
  const targetRaise  = data.targetRaisePence != null
    ? `£${Math.round(data.targetRaisePence / 100).toLocaleString('en-GB')}`
    : 'undisclosed';
  const avgDuration  = data.avgDurationSecs != null
    ? `${Math.round(data.avgDurationSecs / 60)} minutes`
    : 'unknown';

  const contextNote = context
    ? `\n\nAdditional requirements or context from the applicant:\n${context}`
    : '';

  const nhsStage = data.nhsMostAdvanced ?? 'early-stage discussions';

  const sectionPrompts: Record<string, string> = {
    executive_summary: `Write a compelling 250-word executive summary for a ${grantLabel} grant application (${grantName}) from Flowen Technologies Ltd. Flowen is an AI speech therapy app for people who stammer, using proprietary disfluent speech ASR models to deliver real-time biofeedback during practice sessions. Data: ${data.userCount} registered users, ${data.sessionCount} practice sessions completed (avg ${avgDuration} per session), NHS ICB pipeline at ${nhsStage} stage, ${data.ipAssetCount} AI model IP assets. Target grant: ${amountFormatted}. Focus on the clinical problem, our solution, traction, and why we deserve this grant. Use clear, professional language.${contextNote}`,

    problem_statement: `Write a compelling problem statement section for a ${grantLabel} grant application (${grantName}) from Flowen Technologies Ltd. Cover: stammering prevalence (1% of UK population = ~700,000 people), NHS SLT waiting times (18+ months in many areas across England), the lack of accessible, evidence-based digital tools for people who stammer, and the clinical evidence gap in real-time biofeedback therapy for fluency disorders. Reference that Flowen has ${data.userCount} registered users already seeking help. Write in clear, professional prose with specific statistics where possible.${contextNote}`,

    solution: `Write a solution section for a ${grantLabel} grant application (${grantName}) from Flowen Technologies Ltd. Cover: Flowen's proprietary disfluent speech ASR model (fine-tuned on real stammered speech — not available from general-purpose models), real-time biofeedback with sub-150ms latency meeting clinical requirements, structured practice session framework, SLP (Speech and Language Pathologist) integration and oversight capability, DCB0129 clinical safety framework compliance, and mobile-first accessibility. Flowen has ${data.sessionCount} sessions completed averaging ${avgDuration}. Write in clear, professional prose.${contextNote}`,

    market_opportunity: `Write a market opportunity section for a ${grantLabel} grant application (${grantName}) from Flowen Technologies Ltd. UK market: ~700,000 people who stammer, NHS block purchasing model, current NHS SLT cost approximately £2,500 per patient per year. Flowen's NHS ICB pipeline currently at ${nhsStage}. Include the digital therapeutics opportunity, potential for Flowen to dramatically reduce per-patient cost while improving access and clinical outcomes. Current traction: ${data.userCount} registered users, ${data.sessionCount} sessions. Write in clear, professional prose.${contextNote}`,

    team: `Write a team section for a ${grantLabel} grant application (${grantName}) from Flowen Technologies Ltd. Describe a multidisciplinary founding team with: AI/ML engineering expertise (custom ASR model training, real-time audio processing), clinical speech therapy expertise (understanding of stammering, evidence-based therapy approaches), and NHS procurement and health tech commercialisation experience. Emphasise the unique combination of deep tech capability with clinical domain knowledge. Keep individual names vague since this section should describe roles and competencies. Write in clear, professional prose.${contextNote}`,

    financials: `Write a financials section for a ${grantLabel} grant application (${grantName}) from Flowen Technologies Ltd. Frame as follows: Flowen is currently raising a ${data.roundType ?? 'seed'} round (target ${targetRaise}). This grant of ${amountFormatted}, combined with the funding round, will provide sufficient runway to reach key clinical and commercial milestones: completing NHS ICB pilot contracts, achieving regulatory compliance (DCB0129/DTAC), and generating the clinical evidence base needed for wider NHS adoption. Be specific about how grant funds would be deployed (AI model development, clinical validation, regulatory compliance, NHS integration). Write in clear, professional prose.${contextNote}`,

    innovation: `Write an innovation section for a ${grantLabel} grant application (${grantName}) from Flowen Technologies Ltd. Focus on: (1) The proprietary disfluent speech dataset and ASR fine-tuning — stammered speech has fundamentally different acoustic and temporal patterns that general-purpose ASR models (Whisper, Google Speech, etc.) fail to handle reliably; Flowen's model is specifically trained on disfluent speech. (2) Sub-150ms biofeedback latency as a clinical requirement — therapeutic biofeedback must be near-instantaneous to be effective; achieving this on consumer mobile hardware is a non-trivial engineering challenge. (3) The combination of clinical grounding with cutting-edge ML creates a defensible IP position with ${data.ipAssetCount} AI model assets. Write in clear, professional prose.${contextNote}`,
  };

  return sectionPrompts[section] ?? `Write a ${section} section for a ${grantLabel} grant application (${grantName}) from Flowen Technologies Ltd, an AI speech therapy startup for people who stammer.${contextNote}`;
}

// ── Section labels ─────────────────────────────────────────────────────────────

function sectionLabel(section: string): string {
  const map: Record<string, string> = {
    executive_summary: 'Executive Summary',
    problem_statement: 'Problem Statement',
    solution:          'Solution',
    market_opportunity: 'Market Opportunity',
    team:              'Team',
    financials:        'Financials',
    innovation:        'Innovation',
  };
  return map[section] ?? section;
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as GrantWriteRequest;
  const { action, grant_id, section, context } = body;

  if (action !== 'draft') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  if (!grant_id || !section) {
    return NextResponse.json({ error: 'grant_id and section are required' }, { status: 400 });
  }

  const client = db();

  // ── Fetch grant ──────────────────────────────────────────────────────────────

  const { data: grant, error: grantError } = await client
    .from('grants')
    .select('*')
    .eq('id', grant_id)
    .single();

  if (grantError || !grant) {
    return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
  }

  // ── Fetch supporting data in parallel ────────────────────────────────────────

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    profilesRes,
    sessionsRes,
    nhsRes,
    ventureRes,
    ipRes,
  ] = await Promise.all([
    client.from('profiles').select('*', { count: 'exact', head: true }),
    client.from('practice_sessions')
      .select('duration_seconds')
      .gte('created_at', thirtyDaysAgo),
    client.from('nhs_icb_contacts').select('stage'),
    client.from('venture_config').select('round_type, target_raise_pence').limit(1).single(),
    client.from('ip_assets').select('*', { count: 'exact', head: true }).eq('asset_type', 'ai_model'),
  ]);

  // ── Compute aggregates ───────────────────────────────────────────────────────

  const userCount = profilesRes.count ?? 0;

  const sessions = sessionsRes.data ?? [];
  const sessionCount = sessions.length;
  const avgDurationSecs = sessionCount > 0
    ? sessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0) / sessionCount
    : null;

  const nhsContacts = nhsRes.data ?? [];
  const nhsCount = nhsContacts.length;
  const stageOrder = ['prospect', 'engaged', 'demo', 'pilot', 'contracting', 'live'];
  const nhsMostAdvanced = nhsContacts.length > 0
    ? nhsContacts.reduce((best, c) => {
        const bi = stageOrder.indexOf(best ?? '');
        const ci = stageOrder.indexOf(c.stage ?? '');
        return ci > bi ? c.stage : best;
      }, nhsContacts[0]?.stage ?? null)
    : null;

  const ventureData = ventureRes.data;
  const roundType        = ventureData?.round_type        ?? null;
  const targetRaisePence = ventureData?.target_raise_pence ?? null;

  const ipAssetCount = ipRes.count ?? 0;

  const flowenData: FlowenData = {
    userCount,
    sessionCount,
    avgDurationSecs,
    nhsCount,
    nhsMostAdvanced,
    roundType,
    targetRaisePence,
    ipAssetCount,
  };

  // ── Build prompt ──────────────────────────────────────────────────────────────

  const prompt = buildPrompt(
    section,
    grant.name,
    grant.grant_type,
    flowenData,
    grant.amount_pence,
    context,
  );

  // ── Call Claude API ───────────────────────────────────────────────────────────

  const keyError = requireAnthropicKey();
  if (keyError) return keyError;

  let draft: string;
  try {
    const msg = await getAnthropicClient().messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1500,
      system:     'You are an expert grant writer specialising in UK healthcare innovation funding (SBRI Healthcare, Innovate UK). Write in clear, professional prose. Be specific and evidence-based. Avoid buzzwords.',
      messages:   [{ role: 'user', content: prompt }],
    });
    draft = msg.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI API error';
    return NextResponse.json({ error: `Failed to generate draft: ${message}` }, { status: 502 });
  }

  const wordCount = draft.trim().split(/\s+/).filter(Boolean).length;

  return NextResponse.json({
    draft,
    section,
    section_label: sectionLabel(section),
    grant_name:    grant.name,
    word_count:    wordCount,
  });
}
