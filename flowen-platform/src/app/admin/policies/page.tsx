import { assertAdmin } from '@/lib/admin/guard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Internal Policies — Flowen Admin',
};

const EFFECTIVE = '1 August 2026';
const COMPANY = 'Flowen Technologies Ltd';
const EMAIL = 'flowenspeech@outlook.com';

interface PolicyDoc {
  id: string;
  title: string;
  tag: string;
  version: string;
  summary: string;
  content: string;
}

const POLICIES: PolicyDoc[] = [
  {
    id: 'POL-001',
    title: 'Staff Data Handling & Confidentiality Policy',
    tag: 'DATA PROTECTION',
    version: 'v1.0',
    summary: 'Obligations for all staff and contractors handling personal, clinical, or confidential data.',
    content: `STAFF DATA HANDLING & CONFIDENTIALITY POLICY
${COMPANY} | Version 1.0 | Effective ${EFFECTIVE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PURPOSE & SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This policy applies to all employees, contractors, consultants, and volunteers of Flowen Technologies Ltd ("Flowen") who have access to any personal data, special category health data, commercially sensitive information, or technical infrastructure. Compliance is a condition of continued engagement with Flowen.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. DATA PROTECTION OBLIGATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2.1 ALL STAFF must:
— Process personal data only for the purpose for which it was collected and only on the documented instruction of the Data Controller (Flowen Technologies Ltd)
— Never access personal data beyond what is necessary for their specific role (need-to-know principle)
— Keep personal data strictly confidential and not disclose it to any third party without express authorisation from the Data Protection contact
— Immediately report any actual or suspected data breach, loss, or unauthorised access to ${EMAIL} with subject line [DATA INCIDENT]
— Not copy, export, or transfer personal data to personal devices, personal cloud storage, or any system not approved by Flowen
— Not use personal data for any personal purpose, including contacting users outside the Platform

2.2 SPECIAL CATEGORY DATA (voice biomarkers, health metrics)
— Access to clinical session data is restricted to those with a documented operational need
— Clinical data must never be discussed in unsecured environments (open offices, public spaces, personal messaging apps)
— Any handling of clinical data must use approved, encrypted channels only

2.3 SYSTEM ACCESS
— Credentials to the admin portal, Supabase dashboard, Vercel console, or any other system are personal and must not be shared
— Multi-factor authentication must be enabled on all accounts with access to production data
— Credentials must be stored in an approved password manager (not written down, not in plaintext files)
— Access permissions must be requested through the appropriate channel and revoked immediately upon role change or departure

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. CONFIDENTIALITY OBLIGATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3.1 CONFIDENTIAL INFORMATION includes but is not limited to:
— User data (patient records, session data, personal details)
— Clinical data and treatment information
— Commercial contracts, pricing, and business terms
— Source code, algorithms, and technical architecture
— Financial information, revenue figures, and cap table data
— Investor communications and fundraising materials
— NHS engagement details and ICB pipeline information
— Unreleased product features and roadmap details
— Staff salaries and employment terms

3.2 Staff must not disclose Confidential Information to any person outside Flowen without prior written authorisation, except:
— Where disclosure is required by law (e.g., court order, regulatory requirement)
— Where the information is demonstrably in the public domain through no action or omission of the staff member

3.3 Confidential obligations survive termination of employment or engagement for a period of five (5) years.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. DEVICE & REMOTE WORKING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

— Company devices must have full-disk encryption enabled at all times
— Personal devices used for work must have a passcode, screen lock, and must not store production data locally
— Public Wi-Fi must not be used for accessing production systems without a VPN
— Screens showing personal or confidential data must not be visible to unauthorised persons
— Printed documents containing personal data must be shredded (cross-cut) immediately after use

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. INCIDENT REPORTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Any of the following must be reported immediately (within 1 hour of discovery) to ${EMAIL}:
— Suspected or confirmed unauthorised access to any system
— Loss or theft of any device with access to Flowen systems
— Accidental disclosure of personal data to an unintended recipient
— Phishing attacks (whether successful or not)
— Any anomalous activity on any production system

Failure to report a known incident is a disciplinary matter.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. TRAINING & COMPLIANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All staff must:
— Complete data protection awareness training within 14 days of joining and annually thereafter
— Confirm they have read and understood this policy on joining and upon each annual review
— Raise any data protection concerns immediately with ${EMAIL}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. CONSEQUENCES OF BREACH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Breach of this policy may result in:
— Immediate suspension of system access
— Disciplinary action up to and including termination
— Personal liability for ICO fines and regulatory sanctions under the Data Protection Act 2018
— Civil action for breach of confidentiality

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. POLICY OWNER & REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Policy owner: ${EMAIL}
Review frequency: Annual, or upon material change to processing activities
Next review: 1 August 2027`,
  },
  {
    id: 'POL-002',
    title: 'Data Protection Officer Appointment',
    tag: 'GOVERNANCE',
    version: 'v1.0',
    summary: 'Formal DPO designation and terms of appointment under UK GDPR Article 37.',
    content: `DATA PROTECTION OFFICER APPOINTMENT RECORD
${COMPANY} | Version 1.0 | Effective ${EFFECTIVE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APPOINTMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data Controller: Flowen Technologies Ltd, London, United Kingdom
Data Protection Contact: ${EMAIL}
Effective Date: ${EFFECTIVE}

Note on DPO Requirement
Under UK GDPR Article 37, organisations must appoint a DPO where they:
(a) are a public authority or body;
(b) carry out large-scale systematic monitoring of individuals; or
(c) carry out large-scale processing of special category data.

Flowen processes special category voice/health data. While current scale may not trigger mandatory appointment, formal designation of a Data Protection Contact with equivalent responsibilities is adopted as best practice and is required for NHS DSPT compliance.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGNATED RESPONSIBILITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The designated Data Protection contact (or formally appointed DPO, once required) shall:

1. INFORM AND ADVISE
   — Advise Flowen Technologies Ltd and its staff of their obligations under UK GDPR, DPA 2018, and other applicable data protection legislation
   — Monitor compliance with UK GDPR and Flowen's data protection policies

2. DATA PROTECTION IMPACT ASSESSMENTS
   — Provide advice on the conduct of DPIAs (UK GDPR Article 35)
   — Monitor the performance of DPIAs
   — Advise on whether processing activities require a DPIA

3. SUPERVISORY AUTHORITY COOPERATION
   — Act as the contact point for the Information Commissioner's Office (ICO)
   — Cooperate with the ICO on data protection matters
   — Notify the ICO of personal data breaches within 72 hours where required

4. DATA SUBJECT REQUESTS
   — Oversee responses to data subject requests (Articles 15–22)
   — Ensure responses are made within the required timeframe (one calendar month)
   — Maintain a record of all requests and responses

5. ARTICLE 30 RECORDS
   — Maintain and review the Records of Processing Activities (ROPA)
   — Ensure the ROPA is kept accurate and up to date

6. TRAINING
   — Provide or coordinate data protection training for all staff
   — Raise data protection awareness across the organisation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INDEPENDENCE & REPORTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Data Protection contact shall:
— Report directly to the highest management level (founder/director)
— Not receive instructions regarding the exercise of their tasks
— Not be dismissed or penalised for performing their tasks
— Be provided with sufficient resources to carry out their tasks
— Maintain their professional knowledge through ongoing training

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ICO REGISTRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ACTION REQUIRED: Register with the ICO at ico.org.uk/registration before processing NHS patient data. The registration fee is:
— Tier 1 (micro/small org, turnover ≤£632k OR ≤10 staff): £40/year
— Tier 2 (medium org): £60/year
— Tier 3 (large org, turnover >£36m OR >250 staff): £2,900/year

Registration number: [TO BE COMPLETED ON REGISTRATION]
Renewal date: [TO BE COMPLETED]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTACT DETAILS FOR ICO NOTIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ICO breach notification portal: ico.org.uk/make-a-complaint/data-security-incident-trends
ICO helpline: 0303 123 1113
DPA contact for Flowen: ${EMAIL}`,
  },
  {
    id: 'POL-003',
    title: 'Information Governance Policy',
    tag: 'DATA PROTECTION',
    version: 'v1.0',
    summary: 'Overarching IG framework covering data classification, handling, sharing, and disposal.',
    content: `INFORMATION GOVERNANCE POLICY
${COMPANY} | Version 1.0 | Effective ${EFFECTIVE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PURPOSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This policy establishes Flowen's framework for managing information assets in compliance with the UK GDPR, Data Protection Act 2018, NHS Data Security and Protection Toolkit (DSPT), and the DCB0129 Clinical Safety Standard. It applies to all information assets held, processed, or transmitted by Flowen Technologies Ltd.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. INFORMATION CLASSIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All information held by Flowen is classified into one of four tiers:

TIER 1 — PUBLIC
Definition: Information approved for public release (website content, published policies, marketing materials)
Handling: No restrictions; can be shared freely

TIER 2 — INTERNAL
Definition: Operational information for internal use (meeting notes, internal communications, business processes)
Handling: Not for external distribution; may be shared with all staff; encrypted in transit

TIER 3 — CONFIDENTIAL
Definition: Sensitive business information (investor relations, financial data, contracts, commercial terms, unreleased product details)
Handling: Need-to-know access only; encrypted at rest and in transit; DPA required before sharing with third parties

TIER 4 — RESTRICTED (CLINICAL/PERSONAL)
Definition: Personal data, special category health data, clinical session records, voice biomarkers, patient treatment plans
Handling: Strictly need-to-know; UK GDPR lawful basis required; encryption mandatory; DPA in place with all processors; ICO notification for breaches; 7-year clinical record retention minimum

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. DATA FLOWS & SHARING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3.1 INTERNAL SHARING
All data sharing between systems and staff must use approved, encrypted channels. Approved internal systems: Supabase (production database), Vercel (hosting), approved email services. No sharing via SMS, personal messaging apps, or personal email.

3.2 THIRD-PARTY SHARING
Before sharing any Tier 3 or Tier 4 data with a third party:
— Confirm the third party has a signed Data Processing Agreement (for processors) or data sharing agreement (for joint controllers)
— Verify the third party's security posture (ISO 27001, SOC 2, or equivalent)
— Obtain authorisation from the Data Protection contact
— Record the sharing in the ROPA

3.3 NHS/INSTITUTIONAL SHARING
All sharing with NHS organisations, ICBs, or NHS-commissioned bodies must:
— Be governed by a signed Data Processing Agreement
— Comply with the DSPT requirements applicable to the specific organisation
— Be subject to DCB0160 deployment clinical safety assessment by the receiving organisation

3.4 INTERNATIONAL TRANSFERS
No personal data may be transferred outside the UK without an appropriate UK GDPR Chapter V safeguard in place (adequacy regulation, SCCs + UK Addendum, or IDTA). All international transfers must be approved by the Data Protection contact and recorded in the ROPA.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. DATA RETENTION & DISPOSAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4.1 RETENTION SCHEDULE (see Article 30 ROPA for full schedule)
— Account data: Duration of account + 30 days
— Clinical session data: 90 days (default), configurable
— Clinical treatment plan records: Duration + 7 years (NHS standard)
— Financial records: 7 years (HMRC)
— Consent audit log: Permanent

4.2 DISPOSAL
— Digital data: Secure deletion using approved software (DoD 5220.22-M or equivalent); for cloud systems, use provider's certified deletion API
— Clinical data: Anonymise PII using apply_gdpr_erasure() function; verify completion
— Paper documents: Cross-cut shredding; document destruction certificate for clinical records

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. SECURITY CONTROLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TECHNICAL CONTROLS (current implementation)
— AES-256-GCM encryption at rest (Supabase)
— TLS 1.3 in transit; HSTS enforced
— Row-level security (PostgreSQL RLS)
— JWT authentication with server-side expiry
— No raw audio storage (Web Audio API, on-device processing)
— PHI masking on error monitoring (Sentry maskAllText)

ORGANISATIONAL CONTROLS
— Annual staff data protection training (mandatory)
— Staff Data Handling Policy (POL-001)
— Need-to-know access controls
— MFA required on all admin accounts
— Annual external vulnerability assessment (planned)
— Cyber Essentials certification (planned — required for NHS)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. AUDIT & REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

— This policy is reviewed annually or following any material change, data breach, or regulatory development
— Compliance with this policy is audited quarterly by the Data Protection contact
— All data breaches are recorded in the consent_audit_log and reviewed against this policy
— The ROPA (Article 30 register) is reviewed alongside this policy

Policy owner: ${EMAIL}
Next review: 1 August 2027`,
  },
  {
    id: 'POL-004',
    title: 'Business Continuity & Disaster Recovery Plan',
    tag: 'OPERATIONS',
    version: 'v1.0',
    summary: 'Recovery objectives, escalation paths, and continuity procedures for platform incidents.',
    content: `BUSINESS CONTINUITY & DISASTER RECOVERY PLAN
${COMPANY} | Version 1.0 | Effective ${EFFECTIVE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PURPOSE & SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This plan covers Flowen Technologies Ltd's procedures for maintaining or restoring operations following a significant disruptive event. It applies to all production systems including the Flowen web platform (flowen.digital), the Supabase PostgreSQL database, and associated cloud infrastructure.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. RECOVERY OBJECTIVES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOVERY TIME OBJECTIVE (RTO): 4 hours
Maximum acceptable time from incident declaration to restoration of minimum viable service.

RECOVERY POINT OBJECTIVE (RPO): 1 hour
Maximum acceptable data loss. Database backups run every 5 minutes on continuous WAL archiving via Supabase Pro. Point-in-time recovery (PITR) available to the minute.

SERVICE TIERS:
Tier 1 (Critical — RTO 1h): User authentication, practice session recording, database availability
Tier 2 (Important — RTO 4h): Clinical dashboard, SLP portal, PDF report generation
Tier 3 (Standard — RTO 24h): Admin analytics, investor data room, email notifications

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. INFRASTRUCTURE RESILIENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOSTING (VERCEL)
— Serverless edge deployment with automatic failover
— 99.99% uptime SLA on Vercel Pro/Enterprise
— Global CDN with automatic regional routing
— Zero-downtime deployments via Vercel's atomic deployment model
— Rollback: Instant rollback to any previous deployment via Vercel dashboard or CLI (vercel rollback)

DATABASE (SUPABASE)
— Managed PostgreSQL with automatic failover
— Continuous WAL archiving for PITR
— Daily full backups retained for 7 days
— Read replicas: Available in Supabase Pro for geographic distribution
— Restore procedure: Supabase dashboard → Settings → Backups → Point-in-time restore

DATA RESIDENCY
— All data stored in UK-GBR region
— No single point of failure in core data path

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. INCIDENT CLASSIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

P1 — CRITICAL
Definition: Platform completely unavailable; data loss occurring; security breach confirmed
Response: Immediate (within 15 minutes of detection)
Escalation: All available team members; external infrastructure support if needed
Communication: Status page update within 30 minutes; NHS customers notified within 1 hour

P2 — HIGH
Definition: Major feature unavailable (e.g., practice sessions failing, SLP dashboard down); degraded performance affecting >50% of users
Response: Within 1 hour
Escalation: Lead engineer + founder
Communication: Status page update within 1 hour

P3 — MEDIUM
Definition: Non-critical feature unavailable; degraded performance affecting <50% of users; non-production system issues
Response: Within 4 hours
Escalation: Lead engineer
Communication: Status page update within 4 hours

P4 — LOW
Definition: Minor issues with workarounds available; cosmetic bugs; single-user reports
Response: Within 1 business day
Escalation: Standard support queue

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. ESCALATION CONTACTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Primary contact: ${EMAIL}

Infrastructure support:
— Vercel Support: vercel.com/support (Pro/Enterprise SLA: 1-hour response P1)
— Supabase Support: supabase.com/dashboard/support (Business SLA: 4-hour P1)
— Sentry: Support ticket for monitoring gaps

Clinical safety incidents:
— Clinical Safety Officer: ${EMAIL} | Subject: [CLINICAL SAFETY INCIDENT]
— NHS clinical safety incident reporting: per DCB0129 process

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. RECOVERY PROCEDURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PLATFORM OUTAGE (Vercel)
1. Check Vercel status: vercel-status.com
2. Check recent deployments in Vercel dashboard for failed deploys
3. Rollback to last known good: vercel rollback [deployment-url]
4. If infrastructure issue: open Vercel support ticket immediately

DATABASE OUTAGE (Supabase)
1. Check Supabase status: status.supabase.com
2. Log into Supabase dashboard → check database health
3. For data corruption: initiate PITR via Supabase dashboard → Backups → Point-in-time restore
4. Target RPO restore point: last confirmed clean backup before incident

DATA BREACH
1. Isolate: Revoke compromised credentials immediately via Supabase/Vercel dashboard
2. Assess: Determine scope of breach (which data, how many users, timeframe)
3. Notify: Data subjects and ICO within 72 hours if breach meets notification threshold
4. Record: All actions recorded in consent_audit_log
5. Remediate: Patch vulnerability; rotate all credentials; penetration test

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. TESTING & MAINTENANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

— Database restore drill: Annually (restore to staging environment; verify data integrity)
— Escalation contact review: Quarterly (verify all contacts current)
— Plan review: Annually or after any P1/P2 incident
— Tabletop exercise: Annually with all relevant team members

Next scheduled test: 1 February 2027
Last tested: [RECORD AFTER FIRST TEST]

Plan owner: ${EMAIL}
Next review: 1 August 2027`,
  },
  {
    id: 'POL-005',
    title: 'Acceptable Use Policy',
    tag: 'OPERATIONS',
    version: 'v1.0',
    summary: 'Permitted use of Flowen systems, devices, and data by staff and contractors.',
    content: `ACCEPTABLE USE POLICY
${COMPANY} | Version 1.0 | Effective ${EFFECTIVE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This policy governs the use of all Flowen Technologies Ltd information systems, networks, devices, and data by all staff, contractors, and authorised users. Acceptance of this policy is a condition of access to Flowen systems.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. PERMITTED USE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Systems and data may be used for:
— Legitimate business purposes within the scope of the user's role
— Accessing, processing, and analysing data necessary for their specific function
— Communication with colleagues, customers, and partners on business matters
— Development, testing, and maintenance of the Platform (using non-production data in development environments)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. PROHIBITED USE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Users must NOT:
— Use production personal data for development or testing (use anonymised/synthetic data only)
— Access or query data beyond the scope of their role
— Share or transfer production data to personal accounts, devices, or unapproved services
— Install unapproved software on company devices
— Use AI tools (ChatGPT, Claude, Gemini, etc.) to process or analyse identifiable personal or clinical data
— Use AI tools to generate, summarise, or discuss specific user data
— Attempt to bypass security controls, access controls, or audit logging
— Use Flowen systems for personal commercial activities
— Store personal data in unencrypted form on any device
— Use shared or generic accounts (all access must be personally accountable)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. AI TOOL USAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Given the clinical and regulated nature of our data, AI tool usage is governed as follows:

PERMITTED:
— Using AI tools for general coding assistance, documentation drafting, and non-data tasks
— Using AI tools with anonymised/synthetic test data that contains no real user information

STRICTLY PROHIBITED:
— Inputting any identifiable user data (names, emails, session data, clinical records) into any AI tool
— Using AI tools to analyse or summarise specific patient or clinical records
— Sharing any Tier 3 or Tier 4 information (see IG Policy) with AI tools

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. MONITORING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Flowen may monitor system access logs for security and compliance purposes. Users have no expectation of privacy when using company systems. Monitoring is targeted, proportionate, and disclosed in accordance with UK employment law and UK GDPR.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. BREACH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Breach of this policy may result in immediate revocation of system access and disciplinary action. Where the breach involves personal data, regulatory notification to the ICO may be required.

Policy owner: ${EMAIL}
Next review: 1 August 2027`,
  },
  {
    id: 'INV-001',
    title: 'SEIS/EIS Investment Brief',
    tag: 'INVESTOR',
    version: 'v1.1',
    summary: 'SEIS/EIS eligibility confirmation and investment terms for qualifying investors.',
    content: `SEIS/EIS INVESTMENT BRIEF
${COMPANY} | Version 1.1 | Effective ${EFFECTIVE}
STRICTLY CONFIDENTIAL — FOR QUALIFYING INVESTORS ONLY

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT NOTICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This document is for information purposes only and does not constitute a prospectus or offer of securities. Investment in early-stage companies involves significant risk, including the risk of losing your entire investment. SEIS/EIS tax reliefs are subject to individual circumstances and HMRC approval. Past performance is not indicative of future results. This document is issued to persons who are sophisticated investors or high net worth individuals within the meaning of the Financial Services and Markets Act 2000 (Financial Promotion) Order 2005.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPANY OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Company: Flowen Technologies Ltd
Registered: England and Wales
Business: AI-assisted speech fluency platform for people who stammer, with integrated clinical oversight for Speech & Language Therapists
Stage: Pre-revenue / early commercial
Platform: flowen.digital

THE PROBLEM: 1% of the global adult population stammers (approximately 680,000 in the UK). NHS waiting times for speech therapy can exceed 12–18 months. Existing digital tools lack real-time biofeedback and clinical integration.

THE SOLUTION: Flowen combines real-time acoustic analysis, a structured 8-week fluency programme, and a clinical portal enabling SLPs to monitor patient progress between appointments. Audio processing is entirely on-device (no audio stored), ensuring clinical privacy compliance.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEIS/EIS ELIGIBILITY STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ADVANCE ASSURANCE: [Status: Pending / Received — update before use]
HMRC Reference: [Insert on receipt]

Expected Eligibility:
— SEIS: £250,000 lifetime SEIS investment limit; 50% income tax relief; CGT disposal relief; loss relief
— EIS: £12m lifetime EIS investment limit (or £20m for knowledge-intensive companies); 30% income tax relief; CGT deferral; loss relief

Knowledge-Intensive Company Status: Under review. Flowen may qualify given R&D investment in AI/ML acoustic analysis models. KIC status would raise EIS annual limit to £10m per year raised and extend share holding period to 10 years.

IMPORTANT: HMRC Advance Assurance does not guarantee SEIS/EIS qualification for individual investors. Each investor should seek independent tax advice.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNDING ROUND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Round Type: Pre-Seed / Seed SEIS/EIS
Target Raise: [INSERT]
Pre-Money Valuation: [INSERT]
Instrument: Ordinary shares (or ASA/SAFE with SEIS/EIS conversion)
Minimum Investment: £5,000

Use of Funds:
— Clinical validation study and NHS engagement (40%)
— Engineering: mobile app, FHIR integration, offline mode (30%)
— Regulatory: DTAC completion, Cyber Essentials+, pen test (15%)
— Marketing and clinical community partnerships (15%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRACTION & MILESTONES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Update before distributing — pull live data from admin analytics]
— Waitlist signups: [X]
— Platform users: [X]
— Practice sessions: [X]
— SLP professionals registered: [X]
— ICB procurement pipeline: [X active contacts]
— DCB0129 clinical safety compliance: [X]% complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MARKET & COMMERCIAL MODEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MARKET SIZE
— UK total addressable market: ~680,000 adults who stammer
— NHS Speech & Language Therapy annual spend: ~£500m (England)
— Digital health SLT market: Nascent; no established AI platform equivalent

REVENUE MODEL
— B2C subscriptions: £9.99–£14.99/month (individual users)
— B2B NHS/institutional: Per-patient or per-SLP annual licence; block ICB contracts
— Target blended ARPU: £80–150 per user per year
— NHS pathway: DTAC → ICB pilot → national framework contract

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IP & COMPETITIVE MOATS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

— On-device audio processing pipeline (no audio transmitted — unique privacy architecture)
— DCB0129 clinical safety compliance (significant barrier for NHS market entry)
— DTAC qualification process (12–18 month pathway creates competitive moat)
— Proprietary BPM detection model tuned for stammering patterns
— SLP integration portal with clinical workflow features

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY RISKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

— Regulatory risk: DCB0129/DTAC process may take longer than anticipated; NHS procurement cycles are long
— Clinical validation: Real-world effectiveness data takes time to accumulate; clinical evidence expected 12–18 months post-launch
— Competition: Well-funded incumbents (app stores) or NHS internal solutions
— Team risk: Dependence on founding team; key person risk
— Funding risk: Subsequent funding rounds may be at lower valuations or unavailable
— Market risk: NHS budget constraints may delay ICB commissioning

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT STEPS FOR INVESTORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Review Data Room (via personalised secure link)
2. Reference call with clinical advisors (available on request)
3. Platform demo (live or recorded)
4. Legal documentation: Subscription agreement, shareholder agreement, SEIS/EIS compliance certificates
5. Wire transfer per completion instructions

Contact: ${EMAIL}
CONFIDENTIAL — DO NOT DISTRIBUTE WITHOUT AUTHORISATION`,
  },
  {
    id: 'INV-002',
    title: 'Shareholder Agreement Summary',
    tag: 'INVESTOR',
    version: 'v1.0',
    summary: 'Key terms summary of the shareholder agreement for investor orientation. Not a substitute for legal advice.',
    content: `SHAREHOLDER AGREEMENT — KEY TERMS SUMMARY
${COMPANY} | Version 1.0 | Effective ${EFFECTIVE}
CONFIDENTIAL — FOR AUTHORISED SHAREHOLDERS ONLY

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This document is a plain-English summary of key provisions for orientation purposes only. It does not constitute legal advice and is not a substitute for the full shareholder agreement. Shareholders should obtain independent legal advice before relying on this summary. In any conflict between this summary and the full agreement, the full agreement prevails.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHARE CLASSES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ORDINARY SHARES (Class A)
— Held by founders
— Full voting rights (1 vote per share)
— Standard dividend rights

ORDINARY SHARES (Class B) [if applicable]
— Held by SEIS/EIS investors
— Voting rights: [as agreed — typically 1 vote per share or non-voting]
— Anti-dilution protection: [as agreed]
— Drag-along and tag-along rights apply

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY PROTECTIVE PROVISIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESERVED MATTERS (require investor approval at [X]% threshold)
The following actions require approval of a supermajority of shareholders:
— Issue of new shares (except pursuant to approved option pool)
— Winding up or dissolution of the company
— Material change to the company's business
— Sale of substantially all assets
— Incurring debt above £[threshold]
— Amendment to shareholder agreement or articles

INFORMATION RIGHTS
Shareholders holding [X]% or more are entitled to:
— Annual audited accounts (within 6 months of year end)
— Quarterly management accounts (within 30 days of quarter end)
— Investor update letter (monthly during active fundraising; quarterly otherwise)
— Reasonable access to founders for questions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHARE TRANSFER RESTRICTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRE-EMPTION RIGHTS
Before any shareholder may transfer shares, they must offer them pro-rata to existing shareholders at the proposed transfer price. Pre-emption period: 20 business days.

PERMITTED TRANSFERS (no pre-emption required)
— Transfers to family members or connected persons (as defined)
— Transfers to a trust for estate planning purposes
— Transfers to an affiliated company (subject to conditions)

DRAG-ALONG
If shareholders holding [X]% accept a bona fide third-party offer for the entire company, remaining shareholders may be required to sell their shares on the same terms.

TAG-ALONG
If a majority shareholder sells shares to a third party, minority shareholders have the right to sell their shares on equivalent terms.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOUNDER VESTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Founder shares are subject to reverse vesting:
— Vesting schedule: 4 years, 1-year cliff
— Cliff: 25% vests at 12 months from [vesting start date]
— Monthly vesting thereafter: 1/48 per month
— Good leaver / bad leaver provisions apply to unvested shares
— Acceleration: [Single-trigger / double-trigger on change of control]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LIQUIDATION PREFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[If applicable — only relevant if preference shares issued]
In a liquidation or sale event:
— Preference shareholders receive [1×] their invested capital before ordinary shareholders participate
— Preference is [participating / non-participating]
— Any remaining proceeds distributed pro-rata among all shareholders

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GOVERNING LAW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The shareholder agreement is governed by the laws of England and Wales. Disputes shall be resolved by the courts of England and Wales.

Contact for shareholder enquiries: ${EMAIL}
NOTE: [Sections in brackets] require updating with actual agreed terms before use.`,
  },
];

export default async function PoliciesPage() {
  await assertAdmin();

  const byTag = POLICIES.reduce<Record<string, PolicyDoc[]>>((acc, p) => {
    if (!acc[p.tag]) acc[p.tag] = [];
    acc[p.tag].push(p);
    return acc;
  }, {});

  const TAG_COLORS: Record<string, string> = {
    'DATA PROTECTION': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    'GOVERNANCE':      'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'OPERATIONS':      'bg-slate-700/60 text-slate-300 border-slate-600/30',
    'INVESTOR':        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Internal Policies</h1>
          <p className="text-slate-400 text-sm mt-1">
            Operational policies, governance documents, and investor materials — {EFFECTIVE}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/30">
            CONFIDENTIAL
          </span>
          <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-700/60 text-slate-400 border border-slate-600/50">
            INTERNAL
          </span>
        </div>
      </div>

      {/* Index */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {POLICIES.map(doc => (
          <a
            key={doc.id}
            href={`#${doc.id}`}
            className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all group"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono font-bold text-slate-500">{doc.id}</span>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${TAG_COLORS[doc.tag] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {doc.tag}
              </span>
            </div>
            <p className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors leading-snug">
              {doc.title}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">{doc.version}</p>
          </a>
        ))}
      </div>

      {/* Documents */}
      <div className="space-y-4">
        {POLICIES.map(doc => (
          <details key={doc.id} id={doc.id} className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <summary className="flex items-start gap-4 p-5 cursor-pointer list-none hover:bg-slate-800/40 transition-colors">
              <div className="flex-shrink-0 mt-0.5">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {doc.id}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h2 className="text-sm font-bold text-white">{doc.title}</h2>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${TAG_COLORS[doc.tag] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {doc.tag}
                  </span>
                  <span className="text-[10px] font-mono text-slate-600 flex-shrink-0">{doc.version}</span>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed">{doc.summary}</p>
              </div>
              <svg className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </summary>
            <div className="px-5 pb-5 border-t border-slate-800">
              <pre className="mt-4 text-xs text-slate-400 leading-relaxed whitespace-pre-wrap font-sans">
                {doc.content}
              </pre>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-3">
                <span className="text-[10px] font-mono text-slate-600">
                  {doc.id} · {doc.version} · Effective {EFFECTIVE}
                </span>
                <span className="text-[10px] font-mono text-slate-700">|</span>
                <span className="text-[10px] font-mono text-slate-600">Owner: {EMAIL}</span>
              </div>
            </div>
          </details>
        ))}
      </div>

      {/* Footer note */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 text-xs text-slate-500 space-y-1">
        <p>
          <strong className="text-slate-300">Review schedule:</strong> All policies reviewed annually (next review: 1 August 2027) or upon material change to business operations, data processing activities, or applicable legislation.
        </p>
        <p>
          <strong className="text-slate-300">Policy owner:</strong> {EMAIL} — questions or amendments should be directed to the Data Protection contact.
        </p>
        <p>
          <strong className="text-slate-300">Version control:</strong> All versions archived. Current version is authoritative.
        </p>
      </div>
    </div>
  );
}
