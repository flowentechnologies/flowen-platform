/** Controlled preparation documents. Not a clinical approval or NHS release authorisation. */
export const SAFETY_REVIEW_DATE = '30 September 2026';
export const SAFETY_STATUS = 'DRAFT - requires qualified CSO review and management adoption';
export const CSMS_DRAFT = `CLINICAL SAFETY MANAGEMENT SYSTEM AND RISK MANAGEMENT PLAN
FLOWEN-CRM-001 | v1.1 draft | Technical evidence review: 30 September 2026
Status: DRAFT. No clinical approval, signature or NHS release authorisation is recorded here.

1. SCOPE AND GOVERNANCE
Manufacturer: Flowen Group Ltd. Product: adult wellness and fluency practice web platform. The proposed NHS deployment, receiving organisation, clinical pathway and supported release must be defined before clinical release acceptance. Consumer deployment is not evidence of NHS approval. DCB0129 manufacturer duties and the adopter's DCB0160 duties are separate.
Howard Henry is the founder and technical/documentation lead, not a verified qualified Clinical Safety Officer in this record. There is an intention to appoint a clinician to the CSO role; that intention is not a completed appointment. Formal appointment acceptance, full name, current professional registration, risk-management competence/training evidence and authority are still required. Lived experience alone does not satisfy the clinical qualification requirement. No training completion is asserted.
Top management must confirm resources, clinical/technical responsibilities, escalation cover and document/release approval authority. The appointed CSO must approve this plan, each hazard-log version and each safety-case report.

2. LIFECYCLE AND DOCUMENT CONTROL
Apply clinical risk management to requirements, design, development, testing, release, in-service changes and decommissioning. Record each reviewed release's commit/deployment, features, vendors, intended users, limitations and receiving environment. A technical change, incident, new evidence or population/pathway change triggers risk review, not only a major version number.
The canonical hazard record is Admin > Hazard Log, H001-H008. The former H01-H09 table in the IP draft is superseded and must not be used as an approved alternative. Preserve scored history; add hazards only following review. Existing scores are founder-entered working assessments, not a CSO acceptability decision. Product safeguards cannot establish clinical efficacy.
Document register: POL-006 / FLOWEN-CRM-001 (this draft plan); POL-011 / FLOWEN-PMS-001 (monitoring draft); POL-012 / FLOWEN-CSC-001 (safety-case preparation); live hazard log; compliance tracker; source/CI/deployment evidence; incident records. Record approved versions, approver and date without backdating or adding signatures.

3. RISK METHOD AND ACCEPTANCE GATE
The live log uses severity x likelihood, each 1-5, score 1-25: 1-5 low, 6-12 medium, 13-19 high, 20-25 critical. These are local working bands, not a claimed mandatory NHS matrix. The CSO must approve severity definitions, probability basis and acceptability criteria for the actual use environment. Low/medium does not automatically mean accepted. Assess foreseeable misuse, psychological harm, bias, data integrity, service failure and third-party failures. Validate controls with traceable tests and user/clinical evidence. Evaluate individual and overall residual risk and document the clinical decision.
No NHS release until the CSO has approved the plan, issued hazard log and release-specific safety-case report, management has authorised release, and receiving-organisation requirements are met. H005 and H008 remain open; no score or status is changed by this document.

4. THIRD-PARTY AND TECHNICAL EVIDENCE
Reviewed source baseline: b7d88f9214fa6f8bf48d77b786047416a5b24f24. The practice path uses browser microphone/audio processing, the local acoustic RuleEngine and a confidence-labelled HUD. useDisfluencyDetector defaults to 0.65 filtering, not the 0.85 ASR threshold claimed in older hazard notes. Agora ConvoAI payload uses gpt-4o-mini and configurable ElevenLabs/OpenAI speech output; do not describe the whole product as Deepgram Nova-2 plus Claude Haiku without release/configuration evidence.
Confirm enabled vendors, models, regions, retention and fallback settings at release. Assess Supabase, Vercel, Agora and enabled AI/voice providers for clinical consequences of outage, latency, incorrect output, data loss and configuration changes. A vendor SLA, TLS version or encryption assertion needs its own evidence; none is certified by this source review.
Source checks show microphone preflight/error handling, user end/discard controls, session-save errors and event confidence display. They do not establish gold-standard clinical accuracy, a per-event override, offline recovery, 30-second autosave, demographic fairness or clinical benefit. RLS/audit controls require access tests and operational security evidence.

5. CONTROL VERIFICATION AND OPEN ACTIONS
H001/H007: test denied/missing microphone, network loss, provider outage and save failure across supported browsers; retain results. Do not promise recovery checkpoints without a tested implementation.
H002/H003: verify confidence presentation/filtering against labelled expert-reviewed samples and document limits; substantiate or remove claims of user override and sensitivity/specificity monitoring.
H004: evaluate score presentation and distress reporting with appropriate clinical/user input. This reconciliation adds practice-boundary/feedback-limit text and STAMMA/Samaritans support links to the four practice steps. A pause is encouraged but no new automated distress detection or self-exclusion is implemented. Wellbeing check-ins remain unverified. User/clinical validation of the notice is pending.
H005: review intended-purpose and therapy wording across onboarding, practice, paywall, marketing and clinician views. The practice paywall NHS-standard claim is replaced with a preparation-only statement and a boundary notice is added. Other therapy language needs a full copy audit; disclaimers alone cannot eliminate substitution risk. Verify professional-support signposting and user understanding before any clinical acceptance.
H006: retain access-control, deletion, recording retention and breach-response tests; commission independent security testing before a procurer relies on it. Do not infer tested security from policy text.
H008: validate a practical real-world challenge/generalisation prompt, onboarding guidance and follow-up measures. An optional small real-world-conversation prompt is added to the practice review step. A dedicated generalisation tracker and monthly wellbeing emails were not located in the reviewed practice code. No assertion of their operation is made.

6. INCIDENTS, REVIEW AND DECOMMISSIONING
Use the support/ticket route for intake while a dedicated safety incident register and escalation workflow are adopted. Each safety record should include reference/time, reporter, affected release/pathway, actual or possible harm, immediate containment, associated hazard, clinical review, corrective action, owner and closure evidence. Do not infer zero incidents from an empty or unavailable log.
Proposed reviews: operational weekly triage, monthly trends, quarterly hazard/model/clinical evidence review and annual full plan/case review; material changes and safety incidents trigger immediate reassessment. A written cadence is not a scheduled or completed review. Howard and the CSO must nominate owners, backup, exact dates and calendar commitments. Existing August 2027 target is a draft target only.
Plan service retirement, user/clinician communication, safe record transfer/export, access removal and retention/deletion with clinical and data-protection review.

7. REQUIRED HUMAN RECORDS
CSO name/registration/qualification/competence: pending.
Appointment acceptance and authority: pending.
Management adoption and resources: pending.
CSO plan and hazard-log approval: pending.
Intended NHS pathway/population and receiving organisation: pending.
Control-validation results and clinical residual-risk decisions: pending.
Release acceptance/signatures and review schedule: pending.

SOURCE REGISTER
https://digital.nhs.uk/data-and-information/information-standards/information-standards-and-data-collections-including-extractions/publications-and-notifications/standards-and-collections/dcb0129-clinical-risk-management-its-application-in-the-manufacture-of-health-it-systems
https://digital.nhs.uk/binaries/content/assets/website-assets/data-and-information/information-standards/standards-and-collections/dcb0129-clinical-risk-management-its-application-in-the-manufacture-of-health-it-systems/0129242018spec.pdf
https://digital.nhs.uk/services/clinical-safety/applicability-of-dcb-0129-and-dcb-0160/step-by-step-guidance
SOURCE: NHS England DCB0129 Specification v4.2, Amd 24/2018, issued 2 May 2018. Clauses 2.2-2.6, 3.2-3.6 and 7.1-7.3 require governance, competent CSO, approved plan/log/reports, incident management, release review and in-service monitoring. Check current published amendments before formal approval. This plan is preparation, not a certificate.`;

export const PMS_DRAFT = `IN-SERVICE MONITORING / POST-MARKET SURVEILLANCE PLAN
FLOWEN-PMS-001 | v1.1 draft | 30 September 2026
Status: DRAFT - process owner, CSO approval, operational adoption and schedule pending.

PURPOSE
Collect and review safety concerns throughout operation and determine whether new evidence undermines the safety case. DCB0129 is the manufacturer clinical-safety reference; MHRA obligations depend on the intended-purpose/classification assessment. This document does not certify medical-device classification or MHRA compliance.

AVAILABLE INTAKE AND TECHNICAL LEADS
Admin support/ticket, feedback, session-quality and error-monitoring surfaces exist. Their existence is not proof of clinical surveillance, incident completeness, continuous review or clinical validation. User support reports must be triaged for possible harm/near misses, not treated as ordinary product bugs only. Confirm a reachable safety contact, a backup and an approved safety-incident register before adoption. No claim of a live SLT incident-reporting portal or automatic wellbeing alert is made.

DRAFT TRIAGE PROCEDURE
1. Record receipt time, affected release, reporter/contact, description, harm/near miss, immediate action and related hazard.
2. Founder/operational lead acknowledges and routes the report; proposed service target 24 hours, subject to confirmed staffing. Urgent possible harm must not await a weekly meeting. Escalate immediately to the appointed CSO or agreed clinical cover. Do not use the app as an emergency service.
3. CSO assesses clinical significance, likelihood, risk and containment; technical lead checks the affected release/configuration without overwriting evidence.
4. Review whether the hazard log, safety case, user guidance or deployment must change. Record owner, deadline, test/clinical evidence and closure decision.
5. Data-protection lead separately assesses breach notification duties; medical-device reporting applies only where the classification and incident rules require it. No automatic report or external notification is authorised by this draft.

DRAFT CADENCE AND MEASURES
Weekly: triage new reports and technical outages/save errors. Monthly: incident trends, repeat failures, misleading score/feedback complaints, support engagement and any verified wellbeing/generalisation measures. Quarterly: expert-labelled model evaluation, demographic/bias review where lawful/meaningful, literature review, hazard/control evidence and third-party/configuration changes. Annually and after material change: full plan and safety-case review. Record reviewer, date, scope, findings and actions for every review.
Do not treat browser event confidence as clinical accuracy. Do not invent expert reviewers, validation samples or review completion. Analytics is consent-dependent; PostHog cannot be the sole safety-reporting route. No claim of session recordings being available for every user is made.

H005/H008 FOLLOW-UP
Collect evidence of whether users understand that app practice does not replace professional care and whether real-world practice is encouraged/used. Proposed measures require consent/privacy review, a defined owner and clinically reviewed interpretation. Both hazards stay open until control validation and CSO review.

ANNUAL OUTPUT AND ADOPTION
Proposed annual summary: releases/users/sessions in scope, reported incidents and near misses, data limitations, validated performance, changes/corrective actions, outstanding risks and next review. No zero-incident assertion. The earlier August 2027 target is unconfirmed: management/CSO must select an exact date and schedule it.
Owner, backup, CSO escalation contact, register location, review dates, clinical service targets and adoption approval: all pending. The written plan is prepared; operational surveillance is not certified.`;

export const SAFETY_CASE_DRAFT = `CLINICAL SAFETY CASE PREPARATION RECORD
FLOWEN-CSC-001 | v1.1 draft | 30 September 2026
DRAFT - NOT ISSUED, NOT SIGNED, NOT APPROVED FOR NHS DEPLOYMENT.
No CSO acceptability conclusion is made. This replaces competing founder-authored acceptance language and the non-canonical H01-H09 table in the IP draft.

SYSTEM / RELEASE
Flowen adult wellness and fluency practice web platform. Technical evidence baseline b7d88f9214fa6f8bf48d77b786047416a5b24f24. Clinical pathway, consumer-versus-SLT-supervised scope, named NHS receiving organisation, supported release/configuration and population must be agreed before a clinical report is issued. No paediatric or diagnostic indication is approved here.
Clinical/system description: browser audio and local acoustic rules with event-confidence UI; Agora ConvoAI with configured voice/LLM providers where enabled. Specific runtime vendor/model/retention settings remain to be captured for the reviewed release. Refer to FLOWEN-CRM-001 rather than assert unverified encryption, regions, provider SLAs or accuracy.

CANONICAL HAZARD SNAPSHOT (30 SEPTEMBER 2026)
H001 ASR unavailability: recorded mitigated, working residual score 2.
H002 false-positive detection: recorded mitigated, working residual score 6.
H003 false-negative detection: recorded mitigated, working residual score 6.
H004 psychological harm: recorded mitigated, working residual score 4.
H005 substitution for professional therapy: OPEN, working residual score 8.
H006 unauthorised voice/health-data access: recorded mitigated, working residual score 4.
H007 device/microphone failure: recorded mitigated, working residual score 4.
H008 over-reliance / reduced real-world generalisation: OPEN, working residual score 6.
The live Admin > Hazard Log is authoritative for working records. Recorded "mitigated" is not verified CSO approval. Scores are not changed here and are not an acceptance conclusion. Missing control evidence remains, including claims in existing mitigation text; see FLOWEN-CRM-001 action list. No assumption that every foreseeable hazard has been identified.

SAFETY ARGUMENT TO BE TESTED
A. Intended purpose and limitations are consistently understood: not yet established; conflicting therapy/NHS-readiness copy remains a control-validation action.
B. Feedback is sufficiently reliable and does not cause avoidable distress: confidence display and rule tests exist; clinical accuracy, bias and feedback effects are not established.
C. Access/data/recording failures are controlled: source mechanisms exist; release-specific security, failure/recovery and retention tests are still needed.
D. Safety concerns cause timely review and corrective action: written PMS procedure prepared; appointed clinical lead, incident register, staffing and adopted review cadence pending.
E. Overall residual risk is acceptable for a defined deployment: requires the qualified CSO's evidence-based judgment and management release approval. No generated signature or benefit-risk claim can substitute.

RELEASE / REPORT GATE
Record: intended use/pathway/users; receiving organisation; exact source/configuration; approved CRM plan; issued/versioned hazard log; validation evidence mapped to each control; third-party assessment; remaining hazards and clinical decisions; incident review; limitations; management approval; CSO signed report; handoff and adopter requirements. A named procurer is not needed to begin the manufacturer report, but its deployment context is needed for the final handoff. A DCB0129 certificate is not claimed.

DECLARATION - TO BE COMPLETED BY THE APPOINTED QUALIFIED CSO
Name, professional registration, risk-management competence, appointment authority, reviewed versions, residual-risk decision, limitations/conditions, signature and date: PENDING. No person is signed or deemed to have approved this report. Management release decision and adopter DCB0160 handoff: PENDING.

EVIDENCE REGISTER
POL-006 / FLOWEN-CRM-001 draft risk-management plan; POL-011 / FLOWEN-PMS-001 draft monitoring plan; live eight-hazard log; compliance notes; source baseline and automated tests; verified release/deployment; pending clinical/security/user-validation results. DCB0129 official specification v4.2 (Amd 24/2018), particularly 3.2, 3.3, 3.5 and 7.1. Review remains open.`;
