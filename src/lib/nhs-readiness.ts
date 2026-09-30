/** Checklist completion only. Users and hazard bands are not approval evidence. */
export function nhsChecklistCompletion(rows: { framework: string; status: string }[]): number {
  const frameworks = new Set(['dcb0129', 'dtac', 'dspt', 'mhra', 'wcag']);
  const items = rows.filter(row => frameworks.has(row.framework));
  const excluded = items.filter(row => row.status === 'not_applicable').length;
  // The compliance UI defines 42 items. Missing DB rows are not complete.
  const applicable = Math.max(42, items.length) - excluded;
  if (applicable === 0) return 0;
  return Math.round(items.filter(row => row.status === 'complete').length / applicable * 100);
}
