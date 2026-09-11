/**
 * Decides, for a batch of explee_contacts rows not yet linked to the CRM,
 * which already match an existing crm_contacts row by email (link only)
 * and which need a brand new crm_contacts row created (create + link).
 *
 * Real-world scope note, established by probing Explee's actual API
 * directly rather than assuming: there is no "loaded into a campaign but
 * not yet emailed" list anywhere in Explee's public API — every /inbox
 * entry already has sent_count >= 1. So "extract prospects I haven't
 * outreached yet" isn't buildable from this data source; this import
 * covers every contact that has been emailed at least once, whether or
 * not they've replied — the full realistic scope confirmed with the
 * founder before building this.
 *
 * Previously this step only ever linked (skipped silently when no CRM
 * row existed), so the ~1,150+ non-hot contacts already emailed via
 * Explee never made it into the CRM at all — only the small subset the
 * separate explee-hot-leads cron happened to also flag as hot.
 */

export interface UnlinkedExpleeContact {
  id:              string; // explee_contacts.id
  email:           string;
  name:            string | null;
  person_id:       string;
  latest_sent_at:  string | null;
}

export interface CrmImportPlan {
  /** explee_contacts.id -> crm_contacts.id, to write back as crm_contact_id */
  toLink: { expleeContactId: string; crmContactId: string }[];
  /** New crm_contacts rows to insert, keyed by the explee_contacts.id they came from */
  toCreate: { expleeContactId: string; email: string; name: string | null; personId: string; lastContactAt: string | null }[];
}

export function planCrmImport(
  unlinked: UnlinkedExpleeContact[],
  existingCrmByEmail: ReadonlyMap<string, string>,
): CrmImportPlan {
  const toLink: CrmImportPlan['toLink'] = [];
  const toCreate: CrmImportPlan['toCreate'] = [];

  for (const contact of unlinked) {
    const emailKey = contact.email.toLowerCase();
    const existingCrmId = existingCrmByEmail.get(emailKey);
    if (existingCrmId) {
      toLink.push({ expleeContactId: contact.id, crmContactId: existingCrmId });
    } else {
      toCreate.push({
        expleeContactId: contact.id,
        email: contact.email,
        name: contact.name,
        personId: contact.person_id,
        lastContactAt: contact.latest_sent_at,
      });
    }
  }

  return { toLink, toCreate };
}
