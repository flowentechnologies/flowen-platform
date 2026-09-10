import { describe, it, expect } from 'vitest';
import { normalizeArkitMorphName } from './arkit-morph-names';

describe('normalizeArkitMorphName', () => {
  it('converts an _L suffix to Left — the exact facecap_clean.glb naming that never matched before', () => {
    expect(normalizeArkitMorphName('browDown_L')).toBe('browDownLeft');
    expect(normalizeArkitMorphName('mouthSmile_L')).toBe('mouthSmileLeft');
    expect(normalizeArkitMorphName('eyeLookIn_L')).toBe('eyeLookInLeft');
  });

  it('converts an _R suffix to Right', () => {
    expect(normalizeArkitMorphName('browDown_R')).toBe('browDownRight');
    expect(normalizeArkitMorphName('mouthSmile_R')).toBe('mouthSmileRight');
  });

  it('leaves an already-camelCase name unchanged — a Ready Player Me export, or a name with no side suffix', () => {
    expect(normalizeArkitMorphName('mouthSmileLeft')).toBe('mouthSmileLeft');
    expect(normalizeArkitMorphName('jawOpen')).toBe('jawOpen');
    expect(normalizeArkitMorphName('cheekPuff')).toBe('cheekPuff');
    expect(normalizeArkitMorphName('tongueOut')).toBe('tongueOut');
  });

  it('leaves names that already use the no-suffix convention unchanged (facecap_clean.glb is inconsistent: jawLeft/mouthLeft have no underscore at all)', () => {
    expect(normalizeArkitMorphName('jawLeft')).toBe('jawLeft');
    expect(normalizeArkitMorphName('mouthRight')).toBe('mouthRight');
  });
});
