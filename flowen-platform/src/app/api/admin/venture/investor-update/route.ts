import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { FROM } from '@/lib/email';

// ── DB client ──────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── GET — fetch history ────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  if (action === 'history') {
    const client = db();
    const { data, error } = await client
      .from('investor_updates')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(50);

    if (error) {
      // Graceful empty if table missing
      if (error.code === '42P01') return NextResponse.json({ updates: [] });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ updates: data ?? [] });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const action = body.action as string;
  const client = db();

  // ── draft ─────────────────────────────────────────────────────────────────

  if (action === 'draft') {
    // 1. Gather live KPIs from Supabase
    const [
      usersRes,
      sessionsRes,
      nhsRes,
      grantsRes,
      ventureRes,
    ] = await Promise.all([
      // total users (profiles count)
      client.from('profiles').select('id', { count: 'exact', head: true }),
      // sessions last 30 days
      client
        .from('practice_sessions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      // latest NHS ICB stage (most progressed)
      client
        .from('nhs_icb_contacts')
        .select('icb_name, stage')
        .order('created_at', { ascending: false })
        .limit(10),
      // grants pipeline
      client
        .from('grants')
        .select('status, name, amount_pence'),
      // venture config for fundraising context
      client.from('venture_config').select('*').eq('id', 1).maybeSingle(),
    ]);

    const totalUsers    = usersRes.count ?? 0;
    const sessions30d   = sessionsRes.count ?? 0;

    // Determine best NHS stage (map to progression order)
    const stageOrder: Record<string, number> = {
      prospecting: 0, engaged: 1, proposal: 2, pilot: 3, contract: 4, declined: -1,
    };
    let nhsStage = 'No active NHS contacts';
    if (nhsRes.data && nhsRes.data.length > 0) {
      const best = nhsRes.data.reduce((prev, curr) => {
        const prevOrder = stageOrder[prev.stage] ?? -1;
        const currOrder = stageOrder[curr.stage] ?? -1;
        return currOrder > prevOrder ? curr : prev;
      });
      nhsStage = `${best.icb_name} — ${best.stage.charAt(0).toUpperCase() + best.stage.slice(1)}`;
    }

    // Grants summary
    const grantsData = grantsRes.data ?? [];
    const grantsSubmitted = grantsData.filter(g =>
      ['submitted', 'under_review', 'awarded'].includes(g.status)
    ).length;
    const grantsAwarded   = grantsData.filter(g => g.status === 'awarded').length;
    const grantsDrafting  = grantsData.filter(g => g.status === 'drafting').length;

    const ventureConfig = ventureRes.data;
    const committedPence    = ventureConfig?.committed_pence ?? 0;
    const targetPence       = ventureConfig?.target_raise_pence ?? 0;
    const valuationCapPence = ventureConfig?.valuation_cap_pence ?? 0;
    const roundType         = ventureConfig?.round_type ?? 'pre_seed';
    const instrument        = ventureConfig?.instrument ?? 'SAFE';

    // 2. Build the prompt
    const kpiBlock = `
LIVE DATA — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}

Fundraising:
- Round: ${roundType.replace(/_/g, ' ').toUpperCase()} via ${instrument.toUpperCase()}
- Target: £${(targetPence / 100).toLocaleString('en-GB')}
- Committed: £${(committedPence / 100).toLocaleString('en-GB')}
- Valuation cap: £${(valuationCapPence / 100).toLocaleString('en-GB')}

Product & Users:
- Total registered users: ${totalUsers.toLocaleString()}
- Sessions in last 30 days: ${sessions30d.toLocaleString()}

NHS Pipeline:
- Most advanced NHS ICB contact: ${nhsStage}

Grants & Non-dilutive Funding:
- Grants submitted / under review / awarded: ${grantsSubmitted}
- Grants awarded: ${grantsAwarded}
- Grants in drafting: ${grantsDrafting}
`.trim();

    const systemPrompt = `You are writing a concise, professional investor update for Flowen, an AI speech therapy startup for people who stammer. Tone: honest, confident, forward-looking. Format: plain text with clear sections. No marketing fluff.`;

    const userPrompt = `Write a monthly investor update using the live data below. Structure it with these clearly labelled sections:

1. HEADLINE (2–3 sentences: most important development this month)
2. PRODUCT & USERS (key user / session metrics, any product changes)
3. NHS PIPELINE (status of NHS ICB conversations)
4. FUNDRAISING STATUS (round progress, committed amount vs target)
5. GRANTS & NON-DILUTIVE (any grant activity)
6. KEY ASKS (1–3 specific asks from investors — intros, expertise, connections)
7. COMING NEXT MONTH (2–3 concrete priorities)

Keep the whole update under 400 words. Be specific with numbers. Acknowledge what hasn't moved without excessive apology.

${kpiBlock}`;

    // 3. Call Claude
    let draft = '';
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      draft = message.content[0].type === 'text' ? message.content[0].text : '';
    } catch (err) {
      console.error('[investor-update] Claude error:', err);
      return NextResponse.json({ error: 'Failed to generate draft — Claude API error' }, { status: 500 });
    }

    return NextResponse.json({
      draft,
      kpis: {
        users: totalUsers,
        sessions30d,
        nhs_stage: nhsStage,
        grants_submitted: grantsSubmitted,
      },
    });
  }

  // ── send ──────────────────────────────────────────────────────────────────

  if (action === 'send') {
    const { subject, body: emailBody, recipient_emails } = body as {
      subject: string;
      body: string;
      recipient_emails: string[];
    };

    if (!subject || !emailBody || !recipient_emails?.length) {
      return NextResponse.json({ error: 'subject, body and recipient_emails are required' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    let sendResult: { id?: string; mock?: boolean; note?: string } = {};

    if (resendKey) {
      // Use Resend SDK
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);

      // Convert plain text body to basic HTML
      const htmlBody = `<pre style="font-family:sans-serif;white-space:pre-wrap;font-size:14px;line-height:1.7;color:#1e293b;">${emailBody.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;

      const result = await resend.emails.send({
        from: FROM.investors,
        to: ['updates@flowen.digital'], // sender receives one copy
        bcc: recipient_emails,
        subject,
        html: htmlBody,
        text: emailBody,
      });

      if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 400 });
      }
      sendResult = { id: result.data?.id };
    } else {
      // Mock send
      sendResult = { mock: true, note: 'RESEND_API_KEY not configured — email not sent' };
    }

    // Log to investor_updates table
    try {
      await client.from('investor_updates').insert({
        subject,
        body: emailBody,
        recipient_count: recipient_emails.length,
        kpis_snapshot: null,
      });
    } catch {
      // Non-fatal: table may not exist yet
    }

    // Audit log
    await logAuditEvent({
      actor_email: admin.email,
      actor_id: admin.id,
      action: 'investor_update_sent',
      resource_type: 'investor_update',
      metadata: {
        subject,
        recipient_count: recipient_emails.length,
        mock: sendResult.mock ?? false,
      },
      severity: 'info',
    });

    return NextResponse.json({ ok: true, ...sendResult });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
