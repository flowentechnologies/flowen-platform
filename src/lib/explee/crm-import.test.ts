import { describe, it, expect } from 'vitest';
import { planCrmImport, type UnlinkedExpleeContact } from './crm-import';

function contact(overrides: Partial<UnlinkedExpleeContact> = {}): UnlinkedExpleeContact {
  return {
    id: 'ec-1', email: 'jane@example.com', name: 'Jane Doe',
    person_id: 'p-1', latest_sent_at: '2026-09-01T00:00:00Z',
    latest_intent: null, sent_count: 1, reply_count: 0,
    ...overrides,
  };
}

describe('planCrmImport', () => {
  it('links to an existing CRM contact matched by email, case-insensitively', () => {
    const plan = planCrmImport(
      [contact({ email: 'Jane@Example.com' })],
      new Map([['jane@example.com', 'crm-1']]),
    );
    expect(plan.toLink).toEqual([{ expleeContactId: 'ec-1', crmContactId: 'crm-1' }]);
    expect(plan.toCreate).toEqual([]);
  });

  it('creates a new CRM contact when no email match exists — the exact gap this fixes: non-hot Explee contacts used to be silently skipped forever', () => {
    const plan = planCrmImport([contact()], new Map());
    expect(plan.toLink).toEqual([]);
    expect(plan.toCreate).toEqual([{
      expleeContactId: 'ec-1', email: 'jane@example.com', name: 'Jane Doe',
      personId: 'p-1', lastContactAt: '2026-09-01T00:00:00Z',
      intent: null, sentCount: 1, replyCount: 0,
    }]);
  });

  it('handles a mixed batch — some link, some create', () => {
    const plan = planCrmImport(
      [contact({ id: 'ec-1', email: 'a@x.com' }), contact({ id: 'ec-2', email: 'b@x.com' })],
      new Map([['a@x.com', 'crm-a']]),
    );
    expect(plan.toLink).toEqual([{ expleeContactId: 'ec-1', crmContactId: 'crm-a' }]);
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0].expleeContactId).toBe('ec-2');
  });

  it('preserves a null name and null latest_sent_at through to the create plan', () => {
    const plan = planCrmImport([contact({ name: null, latest_sent_at: null })], new Map());
    expect(plan.toCreate[0].name).toBeNull();
    expect(plan.toCreate[0].lastContactAt).toBeNull();
  });

  it('carries intent/sent/reply counts through to the create plan — feeds deriveExpleeStage so a new import lands in the right Kanban column immediately, not always "new"', () => {
    const plan = planCrmImport(
      [contact({ latest_intent: 'hot_lead', sent_count: 2, reply_count: 1 })],
      new Map(),
    );
    expect(plan.toCreate[0]).toMatchObject({ intent: 'hot_lead', sentCount: 2, replyCount: 1 });
  });

  it('returns empty plans for an empty batch', () => {
    const plan = planCrmImport([], new Map());
    expect(plan.toLink).toEqual([]);
    expect(plan.toCreate).toEqual([]);
  });
});
