-- The role='slp' portal (/slp/*) is being retired: zero real profiles ever
-- had role='slp', and this table had zero rows ever (confirmed live before
-- dropping) — nobody applied, nobody was promoted. The /clinicians page's
-- apply form now writes to crm_contacts (category='clinician_lead')
-- instead, so real interest still surfaces somewhere a human actually
-- looks, rather than a dead-end table behind a removed admin review page.
alter table crm_contacts drop constraint crm_contacts_category_check;
alter table crm_contacts add constraint crm_contacts_category_check
  check (category in ('investor','grant','nhs_partner','press','affiliate','vendor','sales_lead','clinician_lead','other'));

drop table if exists slp_beta_applications;
