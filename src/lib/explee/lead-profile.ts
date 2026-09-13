/**
 * Maps Explee's per-thread `LeadProfile` (job title, company, LinkedIn,
 * country, phone — confirmed against Explee's real OpenAPI spec, returned
 * on every `GET .../inbox/{person_id}` thread response) onto the same
 * crm_contacts enrichment columns explee-hot-leads already populates for
 * Explee-flagged hot leads — so every contact gets these fields filled in
 * from the outreach sync too, not just the narrow hot-lead subset.
 *
 * Deliberately only include a field Explee actually returned a non-empty
 * value for: a thread fetch that comes back sparse (or with a field
 * Explee's data just doesn't have yet) must never clobber a value another
 * sync (or a human editing the CRM) already set — the same "don't destroy
 * what's already known" discipline the rest of the Explee sync follows.
 */

export interface LeadProfile {
  name:             string | null;
  email:            string | null;
  job_title:        string | null;
  company_name:     string | null;
  company_domain:   string | null;
  linkedin_url:      string | null;
  country:          string | null;
  phone:            string | null;
  note:             string | null;
  note_updated_at:  string | null;
  note_updated_by:  string | null;
}

export interface CrmEnrichmentPatch {
  job_title?:      string;
  company?:        string;
  company_domain?: string;
  linkedin_url?:   string;
  country?:        string;
  phone?:          string;
}

export function crmEnrichmentFromLeadProfile(lead: LeadProfile | null | undefined): CrmEnrichmentPatch {
  if (!lead) return {};
  const patch: CrmEnrichmentPatch = {};
  if (lead.job_title)       patch.job_title = lead.job_title;
  if (lead.company_name)    patch.company = lead.company_name;
  if (lead.company_domain)  patch.company_domain = lead.company_domain;
  if (lead.linkedin_url)    patch.linkedin_url = lead.linkedin_url;
  if (lead.country)         patch.country = lead.country;
  if (lead.phone)           patch.phone = lead.phone;
  return patch;
}

/** True when the patch actually has at least one field worth writing. */
export function hasEnrichment(patch: CrmEnrichmentPatch): boolean {
  return Object.keys(patch).length > 0;
}
