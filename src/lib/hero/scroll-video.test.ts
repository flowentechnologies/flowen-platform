import { describe, expect, it } from 'vitest';
import { createScrollVideoController, frameTime, heroProgress } from './scroll-video';

describe('hero scroll progress', () => {
  it('clamps before and after the normal-flow section', () => {
    expect(heroProgress(80, 600)).toBe(0);
    expect(heroProgress(-300, 600)).toBe(0.5);
    expect(heroProgress(-900, 600)).toBe(1);
  });
  it('handles invalid sizes and resize without stale viewport math', () => {
    expect(heroProgress(-100, 0)).toBe(0);
    expect(heroProgress(-100, 400)).toBe(0.25);
    expect(heroProgress(-100, 800)).toBe(0.125);
  });
  it('rejects unknown duration and avoids the exact end frame', () => {
    expect(frameTime(0.5, NaN)).toBe(0);
    expect(frameTime(0.5, Infinity)).toBe(0);
    expect(frameTime(1, 10)).toBeCloseTo(10 - 1 / 30);
    expect(frameTime(-1, 10)).toBe(0);
  });
});

class Media extends EventTarget {
  readyState = 0;
  duration = NaN;
  seeking = false;
  pauses = 0;
  seeks: number[] = [];
  time = 0;
  pause() { this.pauses++; }
  get currentTime() { return this.time; }
  set currentTime(value: number) { this.time = value; this.seeking = true; this.seeks.push(value); }
}
describe('serialized scroll-video seeks', () => {
  it('applies the latest scroll once data arrives', () => {
    const media = new Media();
    const c = createScrollVideoController(media as unknown as HTMLVideoElement);
    c.update(0.7);
    expect(media.seeks).toEqual([]);
    media.readyState = 2; media.duration = 10;
    media.dispatchEvent(new Event('loadeddata'));
    expect(media.seeks[0]).toBeCloseTo(frameTime(0.7, 10));
    c.dispose();
  });
  it('coalesces fast scroll and reverse scroll without interrupting a seek', () => {
    const media = new Media(); media.readyState = 2; media.duration = 10;
    const c = createScrollVideoController(media as unknown as HTMLVideoElement);
    c.update(0.8); c.update(0.9); c.update(0.2);
    expect(media.seeks).toHaveLength(1);
    media.seeking = false; media.dispatchEvent(new Event('seeked'));
    expect(media.seeks).toHaveLength(2);
    expect(media.seeks[1]).toBeCloseTo(frameTime(0.2, 10));
    c.dispose();
  });
  it('does not retry forever when a decoder lands on a nearby keyframe', () => {
    const media = new Media(); media.readyState = 2; media.duration = 10;
    const c = createScrollVideoController(media as unknown as HTMLVideoElement);
    c.update(0.7);
    media.time = 0; media.seeking = false;
    media.dispatchEvent(new Event('seeked'));
    expect(media.seeks).toHaveLength(1);
    c.update(0.3);
    expect(media.seeks).toHaveLength(2);
    c.dispose();
  });
  it('removes late media work on cleanup', () => {
    const media = new Media();
    const c = createScrollVideoController(media as unknown as HTMLVideoElement);
    c.update(0.7); c.dispose();
    media.readyState = 2; media.duration = 10;
    media.dispatchEvent(new Event('loadeddata'));
    c.update(0.9);
    expect(media.seeks).toEqual([]);
    expect(media.pauses).toBe(2);
  });
});
