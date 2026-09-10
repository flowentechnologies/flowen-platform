/**
 * Runs `fn` over `items` with at most `concurrency` in flight at once.
 * Preserves input order in the returned array regardless of completion
 * order. Used to parallelize independent, I/O-bound upstream calls (e.g.
 * Explee per-contact thread fetches) that were previously done one at a
 * time — the dominant cost behind explee-outreach-sync's near-300s runs.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
