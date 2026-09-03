import PDFDocument from 'pdfkit';
import { patchPdfkitStandardFonts } from './pdfkit-fonts-patch';

patchPdfkitStandardFonts();

export interface ReportSession {
  created_at: string;
  duration_seconds: number;
  total_blocks_detected: number;
  total_repetitions_detected?: number;
  total_prolongations_detected?: number;
  average_latency_ms?: number;
}

export interface ReportNote {
  note: string;
  created_at: string;
}

export interface ReportData {
  patientName: string;
  patientEmail: string;
  clinicianName: string | null;
  clinicianEmail: string | null;
  reportDate: string;
  reportPeriod: string;        // e.g. "1 Jun 2026 – 21 Aug 2026"
  phase: string | null;
  prescribedStages: number[];
  sessionsPerWeek: number | null;
  minutesPerSession: number | null;
  goals: string | null;
  sessions: ReportSession[];
  notes: ReportNote[];         // clinical notes from SLP
}

const STAGE_NAMES: Record<number, string> = {
  1: 'Diaphragmatic Breathing',
  2: 'Easy Onset & Prolongation',
  3: 'Light Articulatory Contacts',
  4: 'Pausing & Phrasing',
  5: 'Conversational Flow',
};

function bpm(s: ReportSession): number {
  return s.duration_seconds > 0 ? s.total_blocks_detected / (s.duration_seconds / 60) : 0;
}

function computeSummary(sessions: ReportSession[]) {
  const n = sessions.length;
  const totalMins = Math.round(sessions.reduce((a, s) => a + s.duration_seconds, 0) / 60);
  const avgBpm = n > 0 ? sessions.reduce((a, s) => a + bpm(s), 0) / n : null;
  let trend = 'Insufficient data';
  let improvementPct: number | null = null;
  if (n >= 6) {
    const baseline = sessions.slice(0, 3).reduce((a, s) => a + bpm(s), 0) / 3;
    const recent   = sessions.slice(-3).reduce((a, s) => a + bpm(s), 0) / 3;
    if (baseline > 0) {
      improvementPct = Math.round(((baseline - recent) / baseline) * 100 * 10) / 10;
      trend = improvementPct > 10 ? 'Improving' : improvementPct < -10 ? 'Regressing' : 'Plateauing';
    }
  }
  return { n, totalMins, avgBpm, trend, improvementPct };
}

export function generateReport(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4', info: { Title: `Flowen Progress Report — ${data.patientName}`, Author: 'Flowen Speech Technology' } });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 120; // usable width
    const DARK = '#1e293b';
    const MID  = '#64748b';
    const ACC  = '#10b981';
    const RED  = '#ef4444';
    const AMB  = '#f59e0b';

    // ── Header ───────────────────────────────────────────────────────────────
    doc.fontSize(22).font('Helvetica-Bold').fillColor(DARK).text('Flowen', 60, 60);
    doc.fontSize(10).font('Helvetica').fillColor(MID).text('Speech & Language Therapy Progress Report', 60, 86);
    doc.fontSize(9).fillColor(MID).text(`Generated: ${data.reportDate}`, { align: 'right' });
    if (data.reportPeriod) {
      doc.fontSize(8).fillColor(MID).text(`Period: ${data.reportPeriod}`, { align: 'right' });
    }
    doc.moveTo(60, 110).lineTo(doc.page.width - 60, 110).strokeColor('#e2e8f0').stroke();

    // ── Patient info ─────────────────────────────────────────────────────────
    doc.y = 122;
    doc.fontSize(13).font('Helvetica-Bold').fillColor(DARK).text(data.patientName);
    doc.fontSize(9).font('Helvetica').fillColor(MID).text(data.patientEmail);
    if (data.clinicianName) doc.text(`Responsible Clinician: ${data.clinicianName}${data.clinicianEmail ? ` (${data.clinicianEmail})` : ''}`);
    if (data.phase) {
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica-Bold').fillColor(ACC).text(`Treatment Phase: ${data.phase}`);
    }

    // ── Treatment plan box ───────────────────────────────────────────────────
    if (data.prescribedStages.length > 0 || data.goals) {
      doc.moveDown(0.8);
      const boxY = doc.y;
      doc.rect(60, boxY, W, data.goals ? 70 : 44).fillColor('#f0fdf4').fill();
      doc.rect(60, boxY, W, data.goals ? 70 : 44).strokeColor('#bbf7d0').stroke();
      doc.y = boxY + 8;
      doc.fontSize(8).font('Helvetica-Bold').fillColor(ACC).text('PRESCRIBED PLAN', 72, doc.y);
      doc.moveDown(0.3);
      const stageText = data.prescribedStages.map(s => `Stage ${s} — ${STAGE_NAMES[s] ?? ''}`).join('  ·  ');
      doc.fontSize(9).font('Helvetica').fillColor(DARK).text(stageText, 72, doc.y, { width: W - 24 });
      if (data.sessionsPerWeek) {
        doc.fontSize(9).fillColor(MID).text(`Goal: ${data.sessionsPerWeek}×/week · ${data.minutesPerSession} min/session`, 72, doc.y + 2);
      }
      if (data.goals) {
        doc.moveDown(0.4);
        doc.fontSize(8).font('Helvetica-Oblique').fillColor(MID).text(`"${data.goals}"`, 72, doc.y, { width: W - 24 });
      }
      doc.y = boxY + (data.goals ? 78 : 52);
    }

    // ── Summary KPIs ─────────────────────────────────────────────────────────
    const { n, totalMins, avgBpm, trend, improvementPct } = computeSummary(data.sessions);
    doc.moveDown(1);
    const kpiY = doc.y;
    const kpiW = (W - 12) / 4;
    const kpis = [
      { label: 'Total Sessions', value: String(n) },
      { label: 'Practice Time', value: `${totalMins} min` },
      { label: 'Avg Blk/min', value: avgBpm !== null ? avgBpm.toFixed(1) : '—' },
      { label: 'Trend', value: trend, color: trend === 'Improving' ? ACC : trend === 'Regressing' ? RED : AMB },
    ];
    kpis.forEach((k, i) => {
      const x = 60 + i * (kpiW + 4);
      doc.rect(x, kpiY, kpiW, 52).fillColor('#f8fafc').fill().strokeColor('#e2e8f0').stroke();
      doc.fontSize(7).font('Helvetica-Bold').fillColor(MID).text(k.label.toUpperCase(), x + 8, kpiY + 8, { width: kpiW - 16 });
      doc.fontSize(18).font('Helvetica-Bold').fillColor(k.color ?? DARK).text(k.value, x + 8, kpiY + 20, { width: kpiW - 16 });
    });
    if (improvementPct !== null) {
      doc.fontSize(8).font('Helvetica').fillColor(MID)
        .text(`Block rate improvement vs baseline: ${improvementPct > 0 ? '+' : ''}${improvementPct}%`, 60, kpiY + 58);
    }
    doc.y = kpiY + 70;

    // ── Block rate sparkline (text bar chart) ────────────────────────────────
    const chartSessions = data.sessions.slice(-20);
    if (chartSessions.length > 0) {
      doc.moveDown(0.8);
      doc.fontSize(9).font('Helvetica-Bold').fillColor(DARK).text('Block Rate — Last Sessions (blocks/min)');
      doc.moveDown(0.3);
      const chartY = doc.y;
      const maxBpmVal = Math.max(...chartSessions.map(bpm), 1);
      const barW = Math.floor((W - 4) / chartSessions.length) - 1;
      const chartH = 40;
      chartSessions.forEach((s, i) => {
        const val = bpm(s);
        const h = Math.max(2, Math.round((val / maxBpmVal) * chartH));
        const x = 60 + i * (barW + 1);
        const color = val < 2 ? ACC : val <= 5 ? AMB : RED;
        doc.rect(x, chartY + chartH - h, barW, h).fillColor(color).fill();
      });
      doc.fontSize(7).font('Helvetica').fillColor(MID)
        .text('Oldest', 60, chartY + chartH + 4)
        .text('Most recent', 60, chartY + chartH + 4, { align: 'right', width: W });
      doc.y = chartY + chartH + 18;
    }

    // ── Session history table ────────────────────────────────────────────────
    doc.moveDown(0.8);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(DARK).text('Session History');
    doc.moveDown(0.3);

    const cols    = [100, 60, 55, 55, 55, 60];
    const headers = ['Date', 'Duration', 'Blocks', 'Reps', 'Prolong.', 'Blk/min'];
    const tableX  = 60;
    let rowY = doc.y;

    // Header row
    doc.rect(tableX, rowY, W, 18).fillColor('#f1f5f9').fill();
    headers.forEach((h, i) => {
      const x = tableX + cols.slice(0, i).reduce((a, b) => a + b, 0);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(MID).text(h.toUpperCase(), x + 6, rowY + 5, { width: cols[i] - 8 });
    });
    rowY += 18;

    const displaySessions = [...data.sessions].reverse().slice(0, 40);
    displaySessions.forEach((s, idx) => {
      if (rowY > doc.page.height - 80) { doc.addPage(); rowY = 60; }
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(tableX, rowY, W, 16).fillColor(bg).fill().strokeColor('#e2e8f0').stroke();
      const vals = [
        new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }),
        `${Math.floor(s.duration_seconds / 60)}m ${s.duration_seconds % 60}s`,
        String(s.total_blocks_detected),
        String(s.total_repetitions_detected ?? '—'),
        String(s.total_prolongations_detected ?? '—'),
        bpm(s).toFixed(1),
      ];
      vals.forEach((v, i) => {
        const x = tableX + cols.slice(0, i).reduce((a, b) => a + b, 0);
        const bpmVal = bpm(s);
        const color = i === 5 ? (bpmVal < 2 ? ACC : bpmVal <= 5 ? AMB : RED) : DARK;
        doc.fontSize(8).font(i === 5 ? 'Helvetica-Bold' : 'Helvetica').fillColor(color)
          .text(v, x + 6, rowY + 4, { width: cols[i] - 8 });
      });
      rowY += 16;
    });

    // ── Clinical notes ───────────────────────────────────────────────────────
    if (data.notes.length > 0) {
      if (rowY > doc.page.height - 120) { doc.addPage(); rowY = 60; }
      else { rowY += 20; }
      doc.y = rowY;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(DARK).text('Clinical Notes');
      doc.moveDown(0.4);

      for (const note of data.notes) {
        if (doc.y > doc.page.height - 80) doc.addPage();
        const noteDate = new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        doc.fontSize(7).font('Helvetica-Bold').fillColor(MID).text(noteDate, 60, doc.y);
        doc.moveDown(0.1);
        doc.fontSize(8).font('Helvetica').fillColor(DARK).text(note.note, 60, doc.y, { width: W });
        doc.moveDown(0.6);
        // Divider between notes
        doc.moveTo(60, doc.y).lineTo(60 + W, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(0.4);
      }
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 50;
    doc.moveTo(60, footerY).lineTo(doc.page.width - 60, footerY).strokeColor('#e2e8f0').stroke();
    doc.fontSize(8).font('Helvetica').fillColor(MID)
      .text('Flowen Speech Technology Ltd  ·  www.flowen.digital  ·  Confidential clinical document', 60, footerY + 8, { align: 'center', width: W });

    doc.end();
  });
}
