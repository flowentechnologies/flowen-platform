/**
 * Pure helpers for the prospecting feature (find-and-enrich → import into a
 * new Explee campaign) — kept separate from the API routes so the mapping
 * and grouping logic is unit-testable without mocking Explee/Supabase.
 */

export interface FoundProspect {
  id:             string;
  first_name:     string | null;
  last_name:      string | null;
  title:          string | null;
  linkedin_url:   string | null;
  company_name:   string | null;
  company_domain: string | null;
  email:          string | null;
  email_status:   string | null;
}

export interface ImportLead {
  email:           string;
  first_name:      string;
  last_name:       string;
  company_domain:  string;
  job_title:       string;
  linkedin_url:    string;
  company_name:    string;
}

/**
 * Maps a found prospect onto Explee's ImportLeadIn shape. Campaign import
 * requires email/first_name/last_name/company_domain/job_title — a
 * prospect missing any of those (email is the only one find-and-enrich
 * guarantees) is dropped here rather than sent to Explee only to be
 * reported back as skipped; a personal-mailbox domain is left as-is and
 * still submitted, since Explee's own import already flags that itself
 * (flagged_freemail) rather than us silently excluding it.
 */
export function toImportLead(p: FoundProspect): ImportLead | null {
  if (!p.email || !p.first_name || !p.last_name || !p.company_domain || !p.title) return null;
  return {
    email: p.email,
    first_name: p.first_name,
    last_name: p.last_name,
    company_domain: p.company_domain,
    job_title: p.title,
    linkedin_url: p.linkedin_url ?? '',
    company_name: p.company_name ?? '',
  };
}

export function toImportLeads(prospects: FoundProspect[]): { leads: ImportLead[]; skipped: FoundProspect[] } {
  const leads: ImportLead[] = [];
  const skipped: FoundProspect[] = [];
  for (const p of prospects) {
    const lead = toImportLead(p);
    if (lead) leads.push(lead); else skipped.push(p);
  }
  return { leads, skipped };
}

export interface CompanySegment {
  companyDomain: string;
  companyName:   string | null;
  count:         number;
}

/**
 * Groups found prospects by company — the "segment breakdown" view: how
 * many people were found at each company, most-represented first. A
 * prospect with no company_domain (rare — find-and-enrich almost always
 * resolves one) is grouped under a single "unknown" bucket rather than
 * fragmenting into one row per null.
 */
export function groupByCompany(prospects: FoundProspect[]): CompanySegment[] {
  const byDomain = new Map<string, CompanySegment>();
  for (const p of prospects) {
    const domain = p.company_domain ?? '__unknown__';
    const existing = byDomain.get(domain);
    if (existing) {
      existing.count++;
    } else {
      byDomain.set(domain, { companyDomain: domain, companyName: p.company_name, count: 1 });
    }
  }
  return [...byDomain.values()].sort((a, b) => b.count - a.count);
}
