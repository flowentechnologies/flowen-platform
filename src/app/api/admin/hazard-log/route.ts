import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HazardEntry {
  id: string;
  hazard_ref: string;
  hazard_description: string;
  affected_pathway: string;
  cause: string;
  effect: string;
  severity: number;
  likelihood: number;
  risk_score: number;
  risk_level: string;
  mitigation: string;
  residual_severity: number;
  residual_likelihood: number;
  residual_risk_score: number;
  residual_risk_level: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeRiskLevel(score: number): string {
  if (score <= 5)  return 'low';
  if (score <= 12) return 'medium';
  if (score <= 19) return 'high';
  return 'critical';
}

function computeScores(severity: number, likelihood: number) {
  const score = severity * likelihood;
  return { score, level: computeRiskLevel(score) };
}

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01' || Boolean(error.message?.includes('does not exist'));
}

// ── GET — list all hazard entries ─────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = db();

  const { data, error } = await supabase
    .from('hazard_log')
    .select('*')
    .order('hazard_ref');

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ entries: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [] });
}

// ── POST — add | update | delete ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = body.action as string | undefined;
  if (!action || !['add', 'update', 'delete'].includes(action)) {
    return NextResponse.json({ error: 'action must be add | update | delete' }, { status: 400 });
  }

  const supabase = db();

  // ── DELETE ──────────────────────────────────────────────────────────────────
  if (action === 'delete') {
    const id = body.id as string | undefined;
    if (!id) return NextResponse.json({ error: 'id required for delete' }, { status: 400 });

    const { error } = await supabase.from('hazard_log').delete().eq('id', id);
    if (error) {
      if (isMissingTable(error)) return NextResponse.json({ ok: true });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'hazard.delete', resource_type: 'hazard', resource_id: id, severity: 'warning' });
    return NextResponse.json({ ok: true });
  }

  // ── Shared payload validation (add + update) ─────────────────────────────
  const severity          = Number(body.severity);
  const likelihood        = Number(body.likelihood);
  const residualSeverity  = Number(body.residual_severity);
  const residualLikelihood = Number(body.residual_likelihood);

  for (const [name, val] of [
    ['severity', severity],
    ['likelihood', likelihood],
    ['residual_severity', residualSeverity],
    ['residual_likelihood', residualLikelihood],
  ] as [string, number][]) {
    if (!Number.isInteger(val) || val < 1 || val > 5) {
      return NextResponse.json({ error: `${name} must be integer 1–5` }, { status: 400 });
    }
  }

  const VALID_STATUSES  = new Set(['open', 'mitigated', 'accepted', 'closed']);
  const status = (body.status as string | undefined) ?? 'open';
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
  }

  const { score: riskScore, level: riskLevel }         = computeScores(severity, likelihood);
  const { score: residualRiskScore, level: residualRiskLevel } = computeScores(residualSeverity, residualLikelihood);

  // ── ADD ──────────────────────────────────────────────────────────────────────
  if (action === 'add') {
    // Count existing rows to generate the next hazard_ref
    const { count, error: countError } = await supabase
      .from('hazard_log')
      .select('id', { count: 'exact', head: true });

    if (countError && !isMissingTable(countError)) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const nextNum    = (count ?? 0) + 1;
    const hazardRef  = `H${String(nextNum).padStart(3, '0')}`;

    const insertPayload = {
      hazard_ref:           hazardRef,
      hazard_description:   String(body.hazard_description ?? ''),
      affected_pathway:     String(body.affected_pathway   ?? ''),
      cause:                String(body.cause              ?? ''),
      effect:               String(body.effect             ?? ''),
      severity,
      likelihood,
      risk_score:           riskScore,
      risk_level:           riskLevel,
      mitigation:           String(body.mitigation         ?? ''),
      residual_severity:    residualSeverity,
      residual_likelihood:  residualLikelihood,
      residual_risk_score:  residualRiskScore,
      residual_risk_level:  residualRiskLevel,
      status,
      reviewed_by:          (body.reviewed_by as string | null | undefined) ?? null,
      reviewed_at:          null,
    };

    const { data, error } = await supabase
      .from('hazard_log')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json(
          { error: 'hazard_log table does not exist. Please run the migration first.' },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'hazard.add', resource_type: 'hazard', resource_id: data.id, metadata: { hazard_ref: data.hazard_ref, risk_level: data.risk_level }, severity: 'info' });
    return NextResponse.json({ entry: data });
  }

  // ── UPDATE ───────────────────────────────────────────────────────────────────
  const id = body.id as string | undefined;
  if (!id) return NextResponse.json({ error: 'id required for update' }, { status: 400 });

  const updatePayload = {
    hazard_description:   String(body.hazard_description ?? ''),
    affected_pathway:     String(body.affected_pathway   ?? ''),
    cause:                String(body.cause              ?? ''),
    effect:               String(body.effect             ?? ''),
    severity,
    likelihood,
    risk_score:           riskScore,
    risk_level:           riskLevel,
    mitigation:           String(body.mitigation         ?? ''),
    residual_severity:    residualSeverity,
    residual_likelihood:  residualLikelihood,
    residual_risk_score:  residualRiskScore,
    residual_risk_level:  residualRiskLevel,
    status,
    reviewed_by:          (body.reviewed_by as string | null | undefined) ?? null,
    reviewed_at:          body.reviewed_at as string | null ?? null,
  };

  const { data, error } = await supabase
    .from('hazard_log')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: 'hazard_log table does not exist. Please run the migration first.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'hazard.update', resource_type: 'hazard', resource_id: data.id, metadata: { hazard_ref: data.hazard_ref, status: data.status, risk_level: data.risk_level }, severity: 'info' });
  return NextResponse.json({ entry: data });
}
