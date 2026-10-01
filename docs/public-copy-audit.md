# Public copy audit - 1 October 2026

Review-only draft. No production deployment, merge, DNS, SMTP or CMS change.

## Evidence and decisions

The initial review starts from main 69d3c25; this draft was rebased onto 19b0176 after #87. A live anonymous link crawl reached 30 pages, including marketing, funding resources, legal, training and auth pages. The source review also covered public routes outside navigation, metadata, PWA manifest and machine-readable summaries. The blog uses an external CMS, so its article bodies are outside this repository and remain a separate editorial review.

Kept: browser speech practice, guided exercise interfaces, microphone feedback, session history, avatar demonstration and account signup. Evidence: the actual page, component and audio-capture implementations. Three introductory sessions without a card are enforced by the practice paywall. The seven-day subscription trial collects a card and bills automatically unless cancelled, as implemented by the Stripe checkout route.

Cut: sub-80ms, sub-100ms, sub-150ms and under-300ms promises. Audio-frame configuration is not measured microphone-to-screen latency. No repeatable end-to-end benchmark was found. A measurement programme must define supported devices, browser, event type, network conditions, percentile and end-to-end boundary before a numerical claim returns.

Cut: unsupported prevalence/waiting-time statistics, market-first claim, stale onboarding/user metrics, clinic-equivalent feedback, Flowen-specific clinical efficacy, unpublished evaluation F1/precision/recall and 500-session test set, proprietary trained transformer/ASR, native-app availability, testimonials or implied endorsements, unverified lifetime price/refund/affiliate/support-time guarantees.

Fixed: avatar motion follows AI audio rather than mirroring the user's articulation; acoustic feedback is an estimate rather than a clinical tension measurement; clinician interfaces depend on assignment and permissions rather than supplying a therapist with the plan; external funding is subject to approval rather than guaranteed eligibility.

Fixed: security/support copy no longer says audio never leaves the device or is never stored. The privacy policy's audio and processor disclosures are preserved, not narrowed. Company footer uses Flowen Speech Technologies Ltd. Clinical safety documents are controlled drafts, not completed DCB0129 compliance, NHS approval, DTAC assessment or DSPT certification. WCAG checklists without independent verification are replaced with an honest audit-status statement.

Metadata and machine-readable copy no longer contradict the visible pages: no invented offers, unavailable native operating systems, latency or clinical claims. The nonexistent resource search schema is removed.

## Decisions before merge

1. Commission a repeatable latency benchmark if a numerical investor/marketing claim is needed. Neither 80ms nor 300ms is currently used as a verified result.
2. Confirm final live checkout price IDs against displayed pricing, and written founding-rate/refund terms. This PR does not change payment configuration or create contractual guarantees.
3. Have counsel/privacy owner review the DPA corrections. The public draft no longer claims no recordings or UK-only processing. The existing privacy policy still asserts UK storage and safeguards; these are not verified by this code audit, and its broader legal promises have not been narrowed.
4. Decide the regulatory intended use with qualified advice. Copy describes practice without presenting a formal MHRA classification decision.
5. Review external CMS blog articles and their citations before claiming the full public site is evidence-clean. No publication or deletion of CMS content is included.
6. Obtain signed clinical safety, processor-location/transfer, accessibility and security evidence before restoring assurance claims.
7. Avoid merging stale overlapping PR #83 afterward. Live GitHub confirmed #83 is open and unmerged on optimise/landing-page. This branch starts from main and does not modify that branch or #82/#85/#87.

## Verification

358 unit tests pass across 41 files after rebasing onto 19b0176. Changed-file ESLint passes after correcting the existing checkout redirect lint pattern without changing its behavior. Full-project lint has pre-existing errors. Full-project TypeScript verification exhausted the workspace memory budget and is not claimed as passed. Full-app local renders repeatedly exhausted the 2GB workspace. Five public pages were visually inspected in an isolated harness using their exact page components, Tailwind styles and assets, with Next/auth/analytics plumbing stubbed. This is layout evidence, not full-app integration verification. Screenshots caught and removed three leftover pricing testimonials, an unsupported day-five outcome claim and an inconsistent annual discount label. Full-app and mobile visual review remain required before merge. Branch preview deployment is disabled to prevent review builds inheriting production services.

The builder old-to-new text register is in public-copy-change-register.json; the additional pricing removals found during pixel review are recorded in this audit and the PR diff. Full page replacements remove unverified narrative instead of retaining unsupported references with a disclaimer. Existing legal privacy, terms, cookie and safeguarding bodies are preserved; the separate clinical compliance narrative is corrected.
