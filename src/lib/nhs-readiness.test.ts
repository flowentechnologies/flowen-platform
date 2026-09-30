import { describe, expect, it } from 'vitest';
import { nhsChecklistCompletion } from './nhs-readiness';
describe('NHS checklist completion', () => {
  it('does not reward absent evidence or in-progress records', () => {
    expect(nhsChecklistCompletion([])).toBe(0);
    expect(nhsChecklistCompletion([{framework:'dcb0129', status:'in_progress'}])).toBe(0);
  });
  it('counts complete items across the 42-item checklist, not unrelated records', () => {
    expect(nhsChecklistCompletion(Array.from({length:42},()=>({framework:'wcag',status:'complete'})))).toBe(100);
    expect(nhsChecklistCompletion([{framework:'dcb0129',status:'complete'}, {framework:'insurance',status:'complete'}])).toBe(2);
  });
  it('excludes not-applicable items without treating an empty checklist as approval', () => {
    expect(nhsChecklistCompletion([...Array.from({length:41},()=>({framework:'wcag',status:'not_applicable'})), {framework:'dcb0129',status:'complete'}])).toBe(100);
    expect(nhsChecklistCompletion(Array.from({length:42},()=>({framework:'wcag',status:'not_applicable'})))).toBe(0);
  });
});
