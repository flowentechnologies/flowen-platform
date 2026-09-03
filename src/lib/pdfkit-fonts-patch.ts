/**
 * pdfkit's Standard-14 fonts (Helvetica, Helvetica-Bold, Helvetica-Oblique —
 * the three this app uses) are loaded via a plain
 * `fs.readFileSync(__dirname + '/data/Helvetica.afm')` call inside pdfkit
 * itself, resolved at first use, not at import time.
 *
 * In production this throws ENOENT even with next.config.ts's
 * outputFileTracingIncludes correctly configured and verified locally (the
 * route's .nft.json trace does list every pdfkit/js/data/*.afm file) — a
 * currently-unresolved mismatch between Turbopack's per-route file tracing
 * and what Vercel's deployed function bundle actually contains. Rather than
 * depend on that working, this sidesteps the disk read entirely: the exact
 * same AFM text pdfkit ships is embedded in pdfkit-standard-fonts-data.ts,
 * and fs.readFileSync is monkeypatched (once per process) to serve it
 * in-memory for these three specific paths. Every other path — including
 * every other file in this same process — still goes to the real
 * filesystem unchanged.
 *
 * Call patchPdfkitStandardFonts() once, before constructing a PDFDocument
 * that calls .font('Helvetica' | 'Helvetica-Bold' | 'Helvetica-Oblique').
 */
import fs from 'fs';
import { HELVETICA_AFM, HELVETICA_BOLD_AFM, HELVETICA_OBLIQUE_AFM } from './pdfkit-standard-fonts-data';

const AFM_BY_SUFFIX: Record<string, string> = {
  '/data/Helvetica.afm': HELVETICA_AFM,
  '/data/Helvetica-Bold.afm': HELVETICA_BOLD_AFM,
  '/data/Helvetica-Oblique.afm': HELVETICA_OBLIQUE_AFM,
};

let patched = false;

export function patchPdfkitStandardFonts(): void {
  if (patched) return;
  patched = true;

  const original = fs.readFileSync;
  const patchedReadFileSync = ((path: unknown, options?: unknown) => {
    if (typeof path === 'string') {
      const suffix = Object.keys(AFM_BY_SUFFIX).find(s => path.endsWith(s));
      if (suffix) return AFM_BY_SUFFIX[suffix];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (original as any)(path, options);
  }) as typeof fs.readFileSync;

  fs.readFileSync = patchedReadFileSync;
}
