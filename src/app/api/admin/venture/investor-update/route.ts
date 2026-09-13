import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import Anthropic from '@anthropic-ai/sdk';
import { FROM } from '@/lib/email';
import { adminDb as db } from '@/lib/supabase/admin';

// ── DB client ──────────────────────────────────────────────────────────────────

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
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // 1. Gather live KPIs from Supabase
    const [
      usersRes,
      sessionsRes,
      nhsRes,
      grantsRes,
      ventureRes,
      deployRes,
      issuesRes,
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
      // Every production deploy this calendar month with real, user-facing
      // changes — previously nothing here at all, so the draft had zero
      // signal about "what shipped" and defaulted to a generic filler line.
      client
        .from('deploy_log')
        .select('changelog_items, created_at')
        .not('changelog_items', 'is', null)
        .gte('created_at', monthStart.toISOString())
        .order('created_at', { ascending: true }),
      // Any open (non-'ok') consistency-check finding this month — honest
      // visibility into real issues, not just wins.
      client
        .from('consistency_checks')
        .select('check_type, status, summary, checked_at')
        .neq('status', 'ok')
        .gte('checked_at', monthStart.toISOString())
        .order('checked_at', { ascending: false }),
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

    // Real "what shipped this month" — deduped by title, since the same
    // commit/PR can appear multiple times in deploy_log (a redeploy to
    // pick up an env var change re-triggers the webhook without any new
    // code). Grouped by type so the prompt sees "12 new features, 9 fixes"
    // structure rather than one flat, order-random list.
    type ChangelogEntry = { type: string; title: string; description: string | null };
    const seenTitles = new Set<string>();
    const changesByType: Record<string, string[]> = {};
    for (const row of deployRes.data ?? []) {
      for (const item of (row.changelog_items ?? []) as ChangelogEntry[]) {
        const key = item.title.toLowerCase();
        if (seenTitles.has(key)) continue;
        seenTitles.add(key);
        (changesByType[item.type] ??= []).push(item.title);
      }
    }
    const TYPE_LABEL: Record<string, string> = {
      new: 'New', fixed: 'Fixed', improved: 'Improved', security: 'Security', policy: 'Policy',
    };
    const changesBlock = Object.entries(changesByType).length > 0
      ? Object.entries(changesByType)
          .map(([type, titles]) => `${TYPE_LABEL[type] ?? type} (${titles.length}):\n${titles.map(t => `  - ${t}`).join('\n')}`)
          .join('\n\n')
      : 'No user-facing product changes deployed this month.';
    const totalChangesThisMonth = Object.values(changesByType).reduce((s, arr) => s + arr.length, 0);

    // Real open issues — honest visibility, not just wins. consistency-check
    // runs daily and never auto-resolves a discrepancy (by design), so the
    // same unresolved item can recur across many rows; keep only the most
    // recent occurrence per check_type.
    const issuesByType = new Map<string, { summary: string; checked_at: string }>();
    for (const row of issuesRes.data ?? []) {
      if (!issuesByType.has(row.check_type)) issuesByType.set(row.check_type, { summary: row.summary, checked_at: row.checked_at });
    }
    const issuesBlock = issuesByType.size > 0
      ? [...issuesByType.entries()].map(([type, i]) => `- ${type}: ${i.summary}`).join('\n')
      : 'No open consistency-check issues this month.';

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

Product changes shipped this month (${totalChangesThisMonth} total, deduplicated from every production deploy):
${changesBlock}

Open issues this month (from automated consistency checks — billing/marketing/venture data cross-checks):
${issuesBlock}

NHS Pipeline:
- Most advanced NHS ICB contact: ${nhsStage}

Grants & Non-dilutive Funding:
- Grants submitted / under review / awarded: ${grantsSubmitted}
- Grants awarded: ${grantsAwarded}
- Grants in drafting: ${grantsDrafting}
`.trim();

    const systemPrompt = `You are writing a concise, professional investor update for Flowen, an AI speech therapy startup for people who stammer. Tone: honest, confident, forward-looking. Format: plain text with clear sections. No marketing fluff. Never invent a product change, metric, or milestone that isn't in the supplied data — if a section's data says nothing happened, say so plainly rather than filling it with generic language.`;

    const userPrompt = `Write a monthly investor update using the live data below. Structure it with these clearly labelled sections:

1. HEADLINE (2–3 sentences: most important development this month — draw this from the actual product changes and issues listed below, not a generic statement)
2. PRODUCT & USERS (user/session metrics, then highlight the most significant items from "Product changes shipped this month" — group into new features vs. fixes; call out anything that reads as a real user-facing win, however small, and name it specifically rather than saying "various improvements")
3. ISSUES & OPEN ITEMS (state plainly what's listed under "Open issues this month" — if none, say so; don't apologize excessively, just state the fact and whether it's being worked)
4. NHS PIPELINE (status of NHS ICB conversations)
5. FUNDRAISING STATUS (round progress, committed amount vs target)
6. GRANTS & NON-DILUTIVE (any grant activity)
7. KEY ASKS (1–3 specific asks from investors — intros, expertise, connections)
8. COMING NEXT MONTH (2–3 concrete priorities)

Keep the whole update under 500 words (product changes this month means there's real material for section 2 — use the extra room there, not by padding other sections). Be specific with numbers and with feature names. Acknowledge what hasn't moved without excessive apology.

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
