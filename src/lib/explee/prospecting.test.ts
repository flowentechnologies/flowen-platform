import { describe, it, expect } from 'vitest';
import { toImportLead, toImportLeads, groupByCompany, type FoundProspect } from './prospecting';

function prospect(overrides: Partial<FoundProspect> = {}): FoundProspect {
  return {
    id: 'p1', first_name: 'Jane', last_name: 'Doe', title: 'VP Sales',
    linkedin_url: 'https://linkedin.com/in/janedoe', company_name: 'Acme Inc',
    company_domain: 'acme.com', email: 'jane@acme.com', email_status: 'valid',
    ...overrides,
  };
}

describe('toImportLead', () => {
  it('maps a complete prospect onto ImportLeadIn field names', () => {
    expect(toImportLead(prospect())).toEqual({
      email: 'jane@acme.com', first_name: 'Jane', last_name: 'Doe',
      company_domain: 'acme.com', job_title: 'VP Sales',
      linkedin_url: 'https://linkedin.com/in/janedoe', company_name: 'Acme Inc',
    });
  });

  it('defaults linkedin_url/company_name to empty string when absent — both optional in ImportLeadIn', () => {
    const lead = toImportLead(prospect({ linkedin_url: null, company_name: null }));
    expect(lead).toMatchObject({ linkedin_url: '', company_name: '' });
  });

  it('returns null when email is missing — nothing to import without one', () => {
    expect(toImportLead(prospect({ email: null }))).toBeNull();
  });

  it('returns null when first_name, last_name, company_domain, or title is missing — all mandatory for campaign import', () => {
    expect(toImportLead(prospect({ first_name: null }))).toBeNull();
    expect(toImportLead(prospect({ last_name: null }))).toBeNull();
    expect(toImportLead(prospect({ company_domain: null }))).toBeNull();
    expect(toImportLead(prospect({ title: null }))).toBeNull();
  });
});

describe('toImportLeads', () => {
  it('splits a mixed batch into leads and skipped', () => {
    const complete = prospect({ id: 'p1' });
    const incomplete = prospect({ id: 'p2', title: null });
    const { leads, skipped } = toImportLeads([complete, incomplete]);
    expect(leads).toHaveLength(1);
    expect(skipped).toEqual([incomplete]);
  });

  it('returns empty arrays for an empty batch', () => {
    expect(toImportLeads([])).toEqual({ leads: [], skipped: [] });
  });
});

describe('groupByCompany', () => {
  it('groups by company_domain, most-represented first', () => {
    const prospects = [
      prospect({ id: '1', company_domain: 'acme.com', company_name: 'Acme' }),
      prospect({ id: '2', company_domain: 'globex.com', company_name: 'Globex' }),
      prospect({ id: '3', company_domain: 'acme.com', company_name: 'Acme' }),
    ];
    expect(groupByCompany(prospects)).toEqual([
      { companyDomain: 'acme.com', companyName: 'Acme', count: 2 },
      { companyDomain: 'globex.com', companyName: 'Globex', count: 1 },
    ]);
  });

  it('buckets a missing company_domain under "__unknown__" instead of one row per prospect', () => {
    const prospects = [
      prospect({ id: '1', company_domain: null }),
      prospect({ id: '2', company_domain: null }),
    ];
    expect(groupByCompany(prospects)).toEqual([{ companyDomain: '__unknown__', companyName: 'Acme Inc', count: 2 }]);
  });

  it('returns an empty array for no prospects', () => {
    expect(groupByCompany([])).toEqual([]);
  });
});
