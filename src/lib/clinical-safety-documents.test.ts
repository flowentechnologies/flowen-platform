import { describe, it, expect } from 'vitest';
import { CSMS_DRAFT, PMS_DRAFT, SAFETY_CASE_DRAFT } from './clinical-safety-documents';
describe('clinical safety preparation records', () => {
  it('does not manufacture CSO or release approval', () => {
    expect(CSMS_DRAFT).toContain('Formal appointment acceptance');
    expect(SAFETY_CASE_DRAFT).toContain('NOT ISSUED, NOT SIGNED, NOT APPROVED');
    expect(PMS_DRAFT).toContain('operational surveillance is not certified');
  });
  it('uses only the canonical eight-hazard snapshot and retains open hazards', () => {
    expect(SAFETY_CASE_DRAFT.match(/^H00[1-8] /gm)).toHaveLength(8);
    expect(SAFETY_CASE_DRAFT).toContain('H005 substitution for professional therapy: OPEN');
    expect(SAFETY_CASE_DRAFT).toContain('H008 over-reliance / reduced real-world generalisation: OPEN');
    expect(SAFETY_CASE_DRAFT).not.toContain('H009 ');
  });
  it('records controls separately from pending clinical validation', () => {
    expect(CSMS_DRAFT).toContain('0.65');
    expect(CSMS_DRAFT).toContain('User/clinical validation of the notice is pending');
    expect(CSMS_DRAFT).toContain('No NHS release until the CSO');
  });
});
