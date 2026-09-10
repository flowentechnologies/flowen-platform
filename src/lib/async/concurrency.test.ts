import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from './concurrency';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('mapWithConcurrency', () => {
  it('returns results in input order regardless of completion order', async () => {
    const d1 = deferred<number>();
    const d2 = deferred<number>();
    const d3 = deferred<number>();
    const gates = [d1, d2, d3];

    const resultPromise = mapWithConcurrency([0, 1, 2], 3, (_item, i) => gates[i].promise);

    // Resolve out of order — slowest item finishes first.
    d3.resolve(30);
    d1.resolve(10);
    d2.resolve(20);

    expect(await resultPromise).toEqual([10, 20, 30]);
  });

  it('never runs more than `concurrency` at once', async () => {
    let running = 0;
    let maxRunning = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    await mapWithConcurrency(items, 3, async (item) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return item * 2;
    });

    expect(maxRunning).toBeLessThanOrEqual(3);
  });

  it('handles concurrency higher than the item count', async () => {
    const result = await mapWithConcurrency([1, 2], 10, async (n) => n * 10);
    expect(result).toEqual([10, 20]);
  });

  it('handles an empty item list', async () => {
    const result = await mapWithConcurrency<number, number>([], 5, async (n) => n);
    expect(result).toEqual([]);
  });

  it('propagates a thrown error from any worker', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
  });
});
