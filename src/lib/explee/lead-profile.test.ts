import { describe, it, expect } from 'vitest';
import { crmEnrichmentFromLeadProfile, hasEnrichment, type LeadProfile } from './lead-profile';

function lead(overrides: Partial<LeadProfile> = {}): LeadProfile {
  return {
    name: null, email: null, job_title: null, company_name: null, company_domain: null,
    linkedin_url: null, country: null, phone: null, note: null, note_updated_at: null,
    note_updated_by: null, ...overrides,
  };
}

describe('crmEnrichmentFromLeadProfile', () => {
  it('returns an empty patch for a null lead — the common case for a contact Explee has no profile on', () => {
    expect(crmEnrichmentFromLeadProfile(null)).toEqual({});
    expect(crmEnrichmentFromLeadProfile(undefined)).toEqual({});
  });

  it('maps every known field to its crm_contacts column name', () => {
    const patch = crmEnrichmentFromLeadProfile(lead({
      job_title: 'VP Sales', company_name: 'Acme Inc', company_domain: 'acme.com',
      linkedin_url: 'https://linkedin.com/in/jane', country: 'GB', phone: '+44123',
    }));
    expect(patch).toEqual({
      job_title: 'VP Sales', company: 'Acme Inc', company_domain: 'acme.com',
      linkedin_url: 'https://linkedin.com/in/jane', country: 'GB', phone: '+44123',
    });
  });

  it('omits a field entirely when null — never writes a value that would clobber existing CRM data with nothing', () => {
    const patch = crmEnrichmentFromLeadProfile(lead({ job_title: 'VP Sales', company_name: null }));
    expect(patch).toEqual({ job_title: 'VP Sales' });
    expect('company' in patch).toBe(false);
  });

  it('omits a field when it is an empty string, same as null', () => {
    const patch = crmEnrichmentFromLeadProfile(lead({ job_title: '', phone: '+44123' }));
    expect(patch).toEqual({ phone: '+44123' });
  });
});

describe('hasEnrichment', () => {
  it('is false for an empty patch', () => {
    expect(hasEnrichment({})).toBe(false);
  });

  it('is true when at least one field is set', () => {
    expect(hasEnrichment({ job_title: 'VP Sales' })).toBe(true);
  });
});
