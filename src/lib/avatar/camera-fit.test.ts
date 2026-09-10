import { describe, it, expect } from 'vitest';
import { computeFitCamera } from './camera-fit';

describe('computeFitCamera', () => {
  it('looks at the bounding box center, not a hardcoded eye-level fraction', () => {
    const { lookAt } = computeFitCamera([-1, 0, -1], [1, 2, 1], 28);
    expect(lookAt).toEqual([0, 1, 0]);
  });

  it('positions the camera in front of the model (along +z from center)', () => {
    const { position, lookAt } = computeFitCamera([-1, 0, -1], [1, 2, 1], 28);
    expect(position[0]).toBe(lookAt[0]);
    expect(position[1]).toBe(lookAt[1]);
    expect(position[2]).toBeGreaterThan(lookAt[2]);
  });

  it('moves the camera further back for a larger model at the same FOV — this is the exact bug: a fixed camera.position.set(0, headY, 1.5) put the camera inside a small head-only model and only saw the scalp', () => {
    const small = computeFitCamera([-0.1, -0.1, -0.1], [0.1, 0.1, 0.1], 28);
    const large = computeFitCamera([-1, -1, -1], [1, 1, 1], 28);
    const smallDist = small.position[2] - small.lookAt[2];
    const largeDist = large.position[2] - large.lookAt[2];
    expect(largeDist).toBeGreaterThan(smallDist);
  });

  it('scales distance linearly with model size for a fixed FOV', () => {
    const a = computeFitCamera([-1, -1, -1], [1, 1, 1], 28);
    const b = computeFitCamera([-2, -2, -2], [2, 2, 2], 28);
    const distA = a.position[2] - a.lookAt[2];
    const distB = b.position[2] - b.lookAt[2];
    expect(distB / distA).toBeCloseTo(2, 5);
  });

  it('a narrower FOV requires a greater distance to fit the same model', () => {
    const wide = computeFitCamera([-1, -1, -1], [1, 1, 1], 60);
    const narrow = computeFitCamera([-1, -1, -1], [1, 1, 1], 15);
    const wideDist = wide.position[2] - wide.lookAt[2];
    const narrowDist = narrow.position[2] - narrow.lookAt[2];
    expect(narrowDist).toBeGreaterThan(wideDist);
  });

  it('a larger margin factor pushes the camera further back', () => {
    const tight = computeFitCamera([-1, -1, -1], [1, 1, 1], 28, 1.0);
    const loose = computeFitCamera([-1, -1, -1], [1, 1, 1], 28, 2.0);
    const tightDist = tight.position[2] - tight.lookAt[2];
    const looseDist = loose.position[2] - loose.lookAt[2];
    expect(looseDist).toBeCloseTo(tightDist * 2, 5);
  });

  it('handles an off-center bounding box (model not centered on the world origin)', () => {
    const { lookAt } = computeFitCamera([5, 10, -3], [7, 14, 1], 28);
    expect(lookAt).toEqual([6, 12, -1]);
  });
});
