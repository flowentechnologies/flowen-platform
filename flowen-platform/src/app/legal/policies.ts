export const MASTER_POLICIES = {
  company: "Flowen Technologies Ltd",
  jurisdiction: "England and Wales",
  contactEmail: "flowenspeech@outlook.com",
  effectiveDate: "1 August 2026",

  privacyPolicy: `
PRIVACY POLICY & UK GDPR STATEMENT
Last Updated: 1 August 2026
Effective Date: 1 August 2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. WHO WE ARE AND HOW TO CONTACT US
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Flowen Technologies Ltd ("Flowen", "we", "us", "our") is a company registered in England and Wales. We operate the Flowen speech fluency platform, available at flowen.digital and associated subdomains (the "Platform").

For the purposes of UK data protection law, Flowen Technologies Ltd is the Data Controller.

Data Protection Contact
Email: flowenspeech@outlook.com
Write to: Data Protection, Flowen Technologies Ltd, London, United Kingdom

We are committed to protecting your personal data in accordance with the UK General Data Protection Regulation (UK GDPR), the Data Protection Act 2018 (DPA 2018), and the Data (Use and Access) Act 2025.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. THE PERSONAL DATA WE COLLECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We collect the following categories of personal data:

IDENTITY & ACCOUNT DATA
— Full name and chosen display name
— Email address
— Professional role and organisation (for clinicians)
— Account creation date and login history

CLINICAL & HEALTH DATA (Special Category — Article 9 UK GDPR)
— Speech fluency metrics: block frequency, blocks per minute (BPM), disfluency pattern data
— Acoustic biomarkers: root mean square amplitude (RMS), long-term average spectrum (LTI), fundamental frequency
— Therapy stage progression, session completion records, and programme adherence data
— Treatment plans assigned by Speech & Language Pathologists (SLPs), including prescribed stages, session targets, and clinical goals
— Self-reported fluency ratings and therapy notes

IMPORTANT: Raw audio is never stored or transmitted beyond your device. All acoustic analysis is performed in-browser using the Web Audio API. Only processed, anonymised biomarker values (numerical metrics) are sent to our servers. Your voice recordings are never retained.

PAYMENT DATA
— Subscription status and plan type
— Stripe Customer ID (a reference token — we never store full card numbers, CVV codes, or bank account details)
— Payment history and invoice records

COMMUNICATIONS
— Messages exchanged between patients and assigned SLPs within the Platform's clinical messaging system
— Enquiries submitted via contact forms or email

TECHNICAL & USAGE DATA
— IP address and approximate geolocation (country/region)
— Browser type, version, and operating system
— Device type and screen resolution
— Pages visited, features used, and session timestamps
— Error logs (with PHI masking applied via Sentry)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. HOW WE COLLECT YOUR DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

— Directly from you: when you register, complete your profile, undertake practice sessions, or contact us
— From your assigned clinician: treatment plans, clinical goals, and session annotations entered by your SLP
— Automatically: technical and usage data collected as you use the Platform

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. LAWFUL BASES FOR PROCESSING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We rely on the following lawful bases under UK GDPR Article 6:

ARTICLE 6(1)(b) — CONTRACTUAL NECESSITY
Processing necessary to deliver the Platform services you have subscribed to, including:
— Creating and managing your account
— Delivering practice sessions, biofeedback, and therapy programmes
— Processing subscription payments via Stripe
— Providing clinical messaging between patients and SLPs

ARTICLE 6(1)(a) — CONSENT
We rely on your freely given, specific, informed, and unambiguous consent for:
— Processing of special category health and voice biomarker data (see Article 9 below)
— Sending optional marketing communications and product updates
You may withdraw any consent at any time without detriment. Withdrawal does not affect the lawfulness of processing prior to withdrawal.

ARTICLE 6(1)(c) — LEGAL OBLIGATION
Processing required to comply with our legal obligations, including:
— VAT and financial record-keeping under HMRC requirements
— Responding to lawful requests from regulatory authorities
— Data erasure and subject access requests under UK GDPR

ARTICLE 6(1)(f) — LEGITIMATE INTERESTS
Processing necessary for our legitimate interests, where these are not overridden by your rights:
— Maintaining platform security and preventing fraud
— Improving Platform features through aggregated, anonymised analytics
— Defending legal claims

SPECIAL CATEGORY DATA — ARTICLE 9(2)(a) — EXPLICIT CONSENT
For speech fluency metrics and acoustic biomarkers (health data under Article 9), we rely on your explicit, affirmative consent obtained at onboarding. This consent is separately obtained, unbundled from other terms, and recorded in our immutable consent audit log with timestamp.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. HOW WE USE YOUR DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PURPOSE                               | LAWFUL BASIS
——————————————————————————————————————|——————————————————————
Deliver speech practice sessions      | Contract (6(1)(b))
Provide real-time biofeedback         | Contract + Consent (9(2)(a))
Manage SLP–patient clinical workflow  | Contract (6(1)(b))
Process subscription payments         | Contract (6(1)(b))
Generate PDF therapy progress reports | Contract (6(1)(b))
Send session reminders                | Contract (6(1)(b))
Send service and account emails       | Contract (6(1)(b))
Send marketing emails (opt-in only)   | Consent (6(1)(a))
Monitor platform security             | Legitimate interests (6(1)(f))
Anonymised product analytics          | Legitimate interests (6(1)(f))
HMRC compliance and invoicing         | Legal obligation (6(1)(c))
Respond to your support queries       | Contract (6(1)(b))

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. WHO WE SHARE YOUR DATA WITH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We do not sell your personal data. We share data only with the following categories of recipients, under appropriate contractual safeguards (Data Processing Agreements):

SUPABASE INC.
Role: Sub-processor (database and authentication infrastructure)
Data: All Platform data
Safeguard: UK-GBR data centres; Standard Contractual Clauses (SCCs) with UK Addendum

VERCEL INC.
Role: Sub-processor (cloud hosting and edge functions)
Data: Request data, application logs
Safeguard: UK/EU server regions selected; SCCs with UK Addendum

STRIPE INC.
Role: Independent data controller (payment processing)
Data: Payment data, email for receipt
Safeguard: Stripe's own privacy policy governs their processing; they are PCI DSS Level 1 compliant

SENTRY (FUNCTIONAL SOFTWARE INC.)
Role: Sub-processor (error monitoring)
Data: Anonymised error logs (no PHI — PHI masking configured)
Safeguard: SCCs; maskAllText and blockAllMedia enabled

YOUR ASSIGNED SLP (if applicable)
Role: Independent clinical professional
Data: Your session data, fluency metrics, progress reports, and messages
Basis: Your consent and the clinical contract between you and your SLP

LEGAL AUTHORITIES
Where required by law, court order, or to protect the rights and safety of our users, we may disclose data to law enforcement or regulatory authorities.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. INTERNATIONAL TRANSFERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All personal data is stored in UK data centres. Where any processing involves transfer to a country outside the UK (e.g., sub-processor infrastructure), we ensure an appropriate safeguard is in place: UK adequacy regulations, Standard Contractual Clauses (SCCs) with UK Addendum, or the UK International Data Transfer Agreement (IDTA). Transfers to the US occur only where the recipient participates in the UK–US Data Bridge or equivalent safeguard.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. RETENTION PERIODS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DATA TYPE                          | RETENTION PERIOD
———————————————————————————————————|————————————————————————————————
Account and profile data           | Duration of account + 30 days
Speech biomarker session data      | 90 days (default; configurable)
Practice session metadata          | Duration of account + 90 days
Clinical treatment plans           | Duration of clinical relationship + 7 years (NHS standard)
Payment and invoice records        | 7 years (HMRC requirement)
Consent audit log                  | Permanent (immutable audit record)
Erasure request records            | 7 years (legal compliance)
Marketing consent records          | Until consent withdrawn + 3 years
Error logs                         | 90 days

Following account closure or a valid erasure request, identifiable data is anonymised or deleted within 30 calendar days, except where retention is required by law.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. SECURITY MEASURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

— Encryption at rest: AES-256-GCM for all stored data
— Encryption in transit: TLS 1.3 minimum; HSTS enforced
— Row-level security: PostgreSQL RLS enforces strict per-user data isolation
— Access controls: Principle of least privilege; service-role access only for privileged server operations
— No raw audio storage: voice data never leaves your device
— Staff training: All staff with data access complete annual data protection training
— Penetration testing: Annual external vulnerability assessments

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. YOUR RIGHTS UNDER UK GDPR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You have the following rights. To exercise any right, contact flowenspeech@outlook.com. We will respond within one calendar month (UK GDPR Article 12). This period may be extended by two months for complex requests; we will notify you.

RIGHT OF ACCESS (Article 15)
Request a copy of all personal data we hold about you.

RIGHT TO RECTIFICATION (Article 16)
Request correction of inaccurate or incomplete personal data.

RIGHT TO ERASURE (Article 17)
Request deletion of your personal data ("right to be forgotten") where:
— The data is no longer necessary for the purpose it was collected
— You withdraw consent and there is no other lawful basis
— You object under Article 21 and we have no overriding legitimate grounds
— The data has been unlawfully processed
Note: We may retain certain data where required by law (e.g., financial records under HMRC rules).

RIGHT TO RESTRICTION (Article 18)
Request that we restrict processing of your data in defined circumstances.

RIGHT TO DATA PORTABILITY (Article 20)
Receive your personal data in a structured, commonly used, machine-readable format (CSV/JSON) for data processed by automated means on the basis of consent or contract.

RIGHT TO OBJECT (Article 21)
Object to processing based on legitimate interests at any time. We will stop unless we can demonstrate compelling legitimate grounds.

RIGHT TO WITHDRAW CONSENT
Where processing is based on consent, you may withdraw at any time via account settings or by contacting us. Withdrawal does not affect prior lawful processing.

RIGHTS RELATING TO AUTOMATED DECISION-MAKING (Article 22)
We do not make solely automated decisions with legal or similarly significant effects. Clinical recommendations are advisory and require human clinical oversight.

RIGHT TO LODGE A COMPLAINT
You have the right to complain to the Information Commissioner's Office (ICO):
Website: ico.org.uk | Phone: 0303 123 1113 | Post: ICO, Wycliffe House, Water Lane, Wilmslow, SK9 5AF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. CHILDREN'S DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Platform is intended for users aged 16 and over. We do not knowingly collect data from children under 16 without verified parental or guardian consent. If you believe we have received data from a child under 16, please contact flowenspeech@outlook.com immediately.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. UPDATES TO THIS POLICY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We may update this Privacy Policy periodically. Material changes will be communicated by email to registered users at least 30 days before taking effect. The current version is always available at flowen.digital/legal. Continued use of the Platform after the effective date constitutes acceptance of the updated policy.
  `,

  termsOfService: `
TERMS OF SERVICE
Last Updated: 1 August 2026
Effective Date: 1 August 2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. AGREEMENT TO TERMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

By accessing or using the Flowen Platform (flowen.digital and associated subdomains), creating an account, or purchasing a subscription, you ("User", "you") agree to be bound by these Terms of Service ("Terms") and our Privacy Policy. These Terms constitute a legally binding agreement between you and Flowen Technologies Ltd ("Flowen", "we", "us").

If you are accessing the Platform on behalf of an organisation (e.g., an NHS trust, private clinic, or educational institution), you represent and warrant that you have authority to bind that organisation and that these Terms apply to that organisation.

If you do not agree to these Terms, you must not access or use the Platform.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. NATURE OF SERVICE & MEDICAL DISCLAIMER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT FLOWEN IS
Flowen is an AI-assisted speech fluency practice platform designed to support people who stammer in practising evidence-based speech management techniques, including diaphragmatic breathing, easy onset, light articulatory contacts, pausing, and phrasing. The Platform provides real-time biofeedback, structured practice programmes, and — where applicable — clinical oversight from assigned Speech & Language Pathologists (SLPs).

IMPORTANT MEDICAL DISCLAIMER
Flowen is NOT a medical device. Flowen does NOT provide medical diagnosis, clinical treatment, or licensed speech-language pathology services directly. The automated analysis and programme recommendations on the Platform are supportive tools and must not be relied upon as a substitute for professional clinical assessment.

If you have been assigned a clinical SLP through the Platform, your treatment relationship is with that clinician, not with Flowen Technologies Ltd. Flowen provides the technical infrastructure for their clinical practice.

Always seek the advice of a qualified healthcare professional with any questions you may have regarding your health condition. Never disregard professional medical advice or delay seeking it because of content you have read on or received through the Platform.

Individual results vary. Flowen makes no guarantee of fluency improvement, symptom reduction, or any particular therapeutic outcome.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. ELIGIBILITY & ACCOUNT REGISTRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You must be at least 16 years of age to use the Platform. By registering, you confirm you are at least 16. Users between 16 and 18 must have parental or guardian consent.

You must provide accurate, current, and complete registration information. You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You must notify us immediately at flowenspeech@outlook.com if you suspect unauthorised access to your account.

You may not create an account on behalf of another person without their explicit consent. You may not transfer your account to any other party.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. SUBSCRIPTIONS & PAYMENT TERMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUBSCRIPTION PLANS
We offer subscription-based access to the Platform. Current plans and pricing are displayed at flowen.digital. Prices are in GBP and inclusive of any applicable VAT.

BILLING
Subscriptions are billed on a recurring basis (monthly or annually as selected). Payment is processed by Stripe, Inc., our authorised payment processor. By subscribing, you authorise Stripe to charge your payment method on each billing cycle.

FOUNDING MEMBER PRE-ORDERS
Founding Member pre-launch seats are offered at a preferential rate locked for your first 12 months of subscription. Pre-launch pre-payments (made before the Platform's general availability date) are fully refundable on request at any time prior to your first active subscription period commencing. After that, standard terms apply.

CANCELLATION
You may cancel your subscription at any time via your account settings or by emailing flowenspeech@outlook.com. Cancellation takes effect at the end of your current billing period. You retain access until that date. No partial refunds are issued for mid-period cancellations, except as required by consumer law or expressly stated in a promotional offer.

REFUNDS
Where you have statutory cancellation rights under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 (14-day cooling-off period for digital services), we will honour these in full. Refund requests within this period should be sent to flowenspeech@outlook.com with your order reference.

PRICE CHANGES
We will give at least 30 days' written notice of any price increases. You may cancel within this notice period without penalty if you do not wish to continue at the new price.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. CLINICIAN ACCOUNTS & NHS/INSTITUTIONAL USE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Speech & Language Pathologists and other clinical professionals ("Clinicians") who use the Platform to support patients:

— Must be registered with the Health and Care Professions Council (HCPC) or equivalent regulatory body and maintain that registration throughout their use of the Platform.
— Are responsible for their own clinical decision-making. Flowen provides a platform; it does not supervise or direct clinical practice.
— Must obtain appropriate patient consent before assigning patients and accessing clinical data.
— Must comply with their employer's and regulatory body's data protection, clinical governance, and confidentiality obligations.
— Are responsible for maintaining appropriate professional indemnity insurance.

Where the Platform is accessed under an institutional or NHS contract, the contracting organisation is responsible for ensuring all authorised users comply with these Terms and any applicable Data Processing Agreement.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. ACCEPTABLE USE & PROHIBITED CONDUCT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You agree not to:

— Use the Platform for any unlawful purpose or in violation of any applicable laws or regulations
— Attempt to gain unauthorised access to any part of the Platform, other user accounts, or our backend systems
— Submit false, misleading, or fraudulent information during registration or use
— Use automated scripts, bots, or scrapers to access the Platform without authorisation
— Reverse-engineer, decompile, or attempt to extract the source code of any part of the Platform
— Reproduce, distribute, or commercially exploit any Platform content without our prior written consent
— Transmit any malware, viruses, or other harmful code
— Use the Platform to harass, intimidate, or harm any other user
— Circumvent any access controls, rate limits, or technical restrictions
— Resell or sublicense access to the Platform without our written authorisation

Violation of this section may result in immediate account suspension and legal action.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. INTELLECTUAL PROPERTY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All software, algorithms, machine learning models, user interface designs, visual elements (including the Flowen dual-waveform logomark), text content, audio processing methods, and documentation are the exclusive intellectual property of Flowen Technologies Ltd or its licensors, protected by copyright, trade mark, and other applicable laws.

We grant you a limited, non-exclusive, non-transferable, revocable licence to access and use the Platform for your personal or professional therapeutic purposes in accordance with these Terms. This licence does not include any right to copy, modify, distribute, sell, or create derivative works of any Platform content.

Your account data and session data remain yours. You grant us a limited licence to process this data for the purposes set out in our Privacy Policy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. THIRD-PARTY SERVICES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Platform integrates with third-party services including Stripe (payment processing) and Supabase (database infrastructure). Your use of these services may be subject to their own terms of service and privacy policies. We are not responsible for the acts or omissions of third-party service providers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. DISCLAIMERS & WARRANTIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE". TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, FLOWEN TECHNOLOGIES LTD EXPRESSLY DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING BUT NOT LIMITED TO:

— IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
— WARRANTIES THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE FROM HARMFUL COMPONENTS
— WARRANTIES REGARDING THE ACCURACY, COMPLETENESS, OR CURRENCY OF ANY CLINICAL RECOMMENDATIONS

This disclaimer does not affect any mandatory statutory rights you may have as a consumer under English law that cannot be excluded.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. LIMITATION OF LIABILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TO THE FULLEST EXTENT PERMITTED BY ENGLISH LAW:

(a) FLOWEN TECHNOLOGIES LTD SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, LOSS OF PROFITS, LOSS OF DATA, LOSS OF GOODWILL, OR SERVICE INTERRUPTION, HOWEVER CAUSED AND UNDER ANY THEORY OF LIABILITY.

(b) IN NO EVENT SHALL FLOWEN'S TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE PLATFORM EXCEED THE GREATER OF: (i) THE TOTAL AMOUNT PAID BY YOU TO FLOWEN IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE CLAIM; OR (ii) £100.

Nothing in these Terms excludes or limits our liability for death or personal injury caused by negligence, fraudulent misrepresentation, or any other liability that cannot be excluded under English law.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. INDEMNIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You agree to indemnify, defend, and hold harmless Flowen Technologies Ltd and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in any way connected with: (a) your access to or use of the Platform in violation of these Terms; (b) your breach of any representation or warranty in these Terms; or (c) your violation of any applicable law or the rights of any third party.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. TERM, SUSPENSION & TERMINATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

These Terms are effective from the date you first access the Platform and remain in effect until terminated.

We may suspend or terminate your account immediately, without prior notice or liability, if you materially breach these Terms, engage in prohibited conduct, or if required to do so by law. On termination, your right to use the Platform ceases and we may delete your account data in accordance with our Privacy Policy.

You may terminate your account at any time by emailing flowenspeech@outlook.com. Sections 7, 10, 11, and 13 survive termination.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. GOVERNING LAW & DISPUTE RESOLUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

These Terms are governed by the laws of England and Wales. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales. Consumer users in Scotland or Northern Ireland retain the right to bring proceedings before the courts of their home jurisdiction.

We are committed to resolving disputes informally. Before commencing legal proceedings, please contact flowenspeech@outlook.com to seek resolution.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. CHANGES TO THESE TERMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We may revise these Terms from time to time. Material changes will be communicated by email at least 30 days before taking effect. Your continued use of the Platform after the effective date constitutes acceptance. If you do not accept the revised Terms, you should stop using the Platform and cancel your subscription.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. CONTACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For questions about these Terms: flowenspeech@outlook.com
Flowen Technologies Ltd, London, United Kingdom
  `,

  clinicalCompliance: `
DCB0129 CLINICAL SAFETY STATEMENT
Last Updated: 1 August 2026
Version: 1.2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. OVERVIEW & APPLICABILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This statement describes Flowen Technologies Ltd's compliance with NHS Digital Standard DCB0129: Clinical Risk Management for Manufacturers of Health IT (Version 4.2). DCB0129 applies to any organisation manufacturing, developing, or deploying health IT systems that may be used in NHS or NHS-commissioned clinical environments.

System: Flowen Speech Fluency Platform (flowen.digital)
Clinical Safety Officer: Designated — contact flowenspeech@outlook.com
Clinical Safety Manager: Flowen Technologies Ltd

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. CLINICAL SAFETY OFFICER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A Clinical Safety Officer (CSO) has been formally appointed with appropriate clinical and IT competence as required by DCB0129. The CSO is responsible for:

— Oversight of the clinical risk management process throughout the system lifecycle
— Approval of the Clinical Safety Case Report and Hazard Log
— Acting as the accountable clinical signatory for all safety-related decisions
— Liaising with Deployment Clinical Safety Officers at NHS organisations
— Reviewing and approving clinical safety documentation prior to release of each software version

The CSO holds appropriate clinical registration and has completed DCB0129-aligned clinical safety training.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. CLINICAL RISK MANAGEMENT PROCESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We maintain a formal Clinical Risk Management Plan (CRMP) aligned to DCB0129. The CRMP covers:

HAZARD IDENTIFICATION
Hazards are identified through: expert clinical review, structured HAZOP (Hazard and Operability) analysis, user testing with persons who stammer, review of published clinical literature on speech therapy technology, and post-deployment incident reporting.

RISK ASSESSMENT
Each identified hazard is assessed across two dimensions:
— Severity of harm: from negligible (no harm) to catastrophic (death or permanent disability)
— Likelihood of occurrence: from rare to almost certain

Risk scores are calculated and classified as Acceptable, As Low As Reasonably Practicable (ALARP), or Unacceptable.

RISK CONTROLS & MITIGATION
Controls are implemented at the design level (software safeguards), process level (clinical workflow requirements), and user level (in-app guidance and warnings). Residual risk after controls is documented in the Hazard Log.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. KEY HAZARDS & MITIGATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The following represents a summary of key clinical hazards identified. Full Hazard Log available to NHS commissioners on request.

HAZARD 001: INAPPROPRIATE PROGRAMME PROGRESSION
Description: Automated programme advancement occurs when the user has not achieved therapeutic readiness, potentially reinforcing maladaptive speech patterns.
Severity: Moderate | Likelihood: Low | Initial Risk: Low
Mitigation: Auto-advance requires (a) minimum session target completion, (b) BPM quality gate (≤3.5 blocks/minute averaged over qualifying sessions), (c) minimum session duration threshold (90 seconds per qualifying session). Clinical SLP override available. Residual Risk: Very Low.

HAZARD 002: MISSED CLINICAL DETERIORATION
Description: User's speech fluency deteriorates clinically but the Platform does not flag this for SLP review.
Severity: Moderate | Likelihood: Low | Initial Risk: Low
Mitigation: SLP dashboard provides trend visualisations and session-level metrics. Session notes feature allows users to flag concerns. Platform does not replace direct clinical observation. Clear signposting to contact SLP or GP for clinical concerns. Residual Risk: Very Low.

HAZARD 003: MISINTERPRETATION OF BIOFEEDBACK AS CLINICAL DIAGNOSIS
Description: User interprets real-time BPM or fluency metric as a clinical diagnosis or severity grading.
Severity: Low | Likelihood: Moderate | Initial Risk: Low
Mitigation: In-app labelling explicitly states all metrics are for practice feedback only. Medical disclaimer presented at onboarding and in Terms of Service. Biofeedback presented as directional coaching cues, not diagnostic scores. Residual Risk: Negligible.

HAZARD 004: DATA ACCURACY AFFECTING CLINICAL DECISIONS
Description: Inaccurate session data (e.g., due to device microphone quality or background noise) influences SLP clinical decisions.
Severity: Moderate | Likelihood: Low | Initial Risk: Low
Mitigation: SLPs are trained that Platform data is supportive evidence, not diagnostic. Session quality indicators surfaced in the clinician dashboard. Data clearly labelled with collection method. Clinical Safety Training guidance provided to deploying NHS organisations. Residual Risk: Very Low.

HAZARD 005: DELAY IN ACCESS TO APPROPRIATE CLINICAL CARE
Description: User relies solely on self-directed Platform use when specialist clinical intervention is required.
Severity: Moderate | Likelihood: Low | Initial Risk: Low
Mitigation: Users recommended to seek qualified SLP assessment. SLP integration pathway built into platform. Clear signposting to STAMMA (British Stammering Association) and NHS referral pathways. Emergency contact resources displayed in platform settings. Residual Risk: Very Low.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. CLINICAL SAFETY CASE REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A Clinical Safety Case Report (CSCR) has been produced and is maintained in accordance with DCB0129 Section 4.3. The CSCR documents:

— System description and clinical context
— Hazard identification methodology and results
— Risk assessments and control measures
— Evidence of residual risk acceptability
— Clinical Safety Officer sign-off for each system version

The CSCR is updated prior to each major release and following any clinical safety incident. Current CSCR version: 1.2 (August 2026). NHS commissioners and Deployment Clinical Safety Officers may request a copy by contacting flowenspeech@outlook.com.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. DEPLOYMENT REQUIREMENTS (DCB0160 READINESS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NHS organisations deploying the Flowen Platform must comply with DCB0160 (Clinical Risk Management for Deployment of Health IT). Deploying organisations should:

— Appoint a Deployment Clinical Safety Officer (DCSO)
— Review Flowen's Clinical Safety Case Report and Hazard Log
— Conduct a local hazard assessment for their clinical environment
— Ensure clinical staff complete appropriate training before use
— Establish a local incident reporting pathway to Flowen's Clinical Safety Officer
— Agree a Data Processing Agreement with Flowen Technologies Ltd

Flowen will provide full DCB0129 documentation pack, training materials, and a named clinical safety contact upon contracting.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. CLINICAL SAFETY INCIDENT REPORTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Clinical safety incidents or near-misses related to the Flowen Platform should be reported to: flowenspeech@outlook.com with the subject line [CLINICAL SAFETY INCIDENT].

We will acknowledge reports within 24 hours and investigate within 72 hours. Serious incidents will be escalated to our Clinical Safety Officer and reported to appropriate regulatory bodies as required. A written investigation report will be provided to the reporting organisation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. DTAC ALIGNMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Flowen is aligned with the NHS Digital Technology Assessment Criteria (DTAC) across five domains:

CLINICAL SAFETY: DCB0129 compliance as documented above.
DATA PROTECTION: UK GDPR compliant; ICO registered; Data Processing Agreements available; Data Security and Protection Toolkit (DSPT) baseline standards met.
TECHNICAL SECURITY: ISO 27001-aligned security controls; AES-256 encryption; TLS 1.3; penetration testing; vulnerability management programme.
INTEROPERABILITY: FHIR R4 integration roadmap in development; API documentation available to NHS technical teams on request.
USABILITY & ACCESSIBILITY: WCAG 2.1 AA partial conformance (see Accessibility Statement); validated with people who stammer across age groups.

Full DTAC evidence pack available to NHS procurement teams on request.
  `,

  governingLaw: `
GOVERNING LAW & DISPUTE RESOLUTION
Last Updated: 1 August 2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GOVERNING LAW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

These Terms of Service, Privacy Policy, and all other policies and agreements between you and Flowen Technologies Ltd are governed by, and shall be construed in accordance with, the laws of England and Wales, without regard to conflict of law principles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JURISDICTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Subject to the provisions below, the courts of England and Wales shall have exclusive jurisdiction to resolve any dispute or claim arising out of or in connection with these agreements or their subject matter or formation (including non-contractual disputes or claims).

Notwithstanding the above:
— Consumer users in Scotland may bring proceedings before Scottish courts.
— Consumer users in Northern Ireland may bring proceedings before Northern Irish courts.
— Nothing in this clause affects your rights to bring proceedings before the courts of another EU/EEA member state if you are habitually resident there and the relevant law requires it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INFORMAL DISPUTE RESOLUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before commencing formal legal proceedings, both parties agree to attempt to resolve any dispute informally. Please email flowenspeech@outlook.com with a description of the dispute and your proposed resolution. We will respond within 14 days. If the dispute is not resolved within 30 days of this notification, either party may proceed to formal dispute resolution.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONSUMER STATUTORY RIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Nothing in these Terms affects your statutory rights as a consumer under English law, including rights under the Consumer Rights Act 2015, the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013, and the Consumer Protection from Unfair Trading Regulations 2008.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Flowen Technologies Ltd
London, United Kingdom
flowenspeech@outlook.com
flowen.digital
  `
};
