export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function datasetPage(value: string | null): number | null {
  const n = Number(value ?? 0);
  return Number.isSafeInteger(n) && n >= 0 && n <= 100000 ? n : null;
}
export function validAnnotations(value: unknown, duration: number): boolean {
  if (!Array.isArray(value) || value.length > 5000 || !Number.isFinite(duration) || duration <= 0) return false;
  return value.every(e => e && typeof e === 'object' &&
    ['BLOCK', 'PROLONG', 'REP_START', 'REP_END', 'INTERJ', 'FALSE_START'].includes(e.type) &&
    Number.isFinite(e.onset_ms) && Number.isFinite(e.duration_ms) && e.onset_ms >= 0 && e.duration_ms >= 0 &&
    e.onset_ms + e.duration_ms <= duration * 1000);
}
