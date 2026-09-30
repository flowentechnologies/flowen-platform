# Flowen architecture audit - 30 September 2026

This is a first audit pass, not a declaration that the platform is bug-free. No production mutation, migration, tracking change or model training was performed. Merge and deployment require owner review.

## Inventory and coverage

- 124 Next.js page routes and 174 API routes inventoried from the fresh main checkout.
- Static literal page destinations checked against page routes: no unmatched destination found. Dynamic paths, anchor targets and authorization are separate checks and are not certified by this result.
- Existing unit suite: 253 tests in 34 files passed. Added 12 redirect tests and 6 audio-upload route tests: total 286 tests in 37 files passed.
- Auth/proxy and audio-upload changed files pass ESLint. Full TypeScript check passes. GitHub CI passes and the initial Vercel preview is Ready. Whole-project lint exceeds the local time window and has not been certified.
- Live anonymous dashboard correctly redirects to login with `next=/dashboard`.
- Admin and dashboard navigation have route destinations. Authenticated end-to-end user, clinician, billing, recording and admin workflows still require test identities and controlled non-production fixtures. No practice session, invitation, payment, email or personal account state was generated during this audit.

## Fixed in this PR

| Severity | Defect | Fix |
|---|---|---|
| High | Recovery callback sends admins to admin and incomplete users to onboarding before the reset form; proxy sends all authenticated users away from reset page | Exact recovery exception before role/milestone redirects; allow reset and forgot-password pages with a session |
| Medium | Password login discards the requested destination while OAuth/magic link keep it | Hidden next field, validated server destination, preservation through login errors and onboarding |
| Medium | Redirect validation accepts backslash URL forms and auth-loop destinations | Shared same-origin parser rejects backslashes/control characters, external destinations and normalized auth routes |
| Medium | Reset success redirects to login while session remains active, so success message is skipped | Sign out after successful update, then show password-updated login state |
| Medium | Login double-decodes the already-decoded error query, so a percent sign can crash rendering | Render the parsed error directly |
| Medium | OAuth failure leaves login button permanently in Redirecting state | Surface returned error and reset loading state |
| Medium | npm run lint invokes removed Next 16 next lint and never runs ESLint | Use ESLint directly, retaining the existing rules |

## Findings still open

- `src/app/api/practice/asr/route.ts` promises a per-user limiter in its header but implements no limiter. Coordinate with the ASR workstream; do not silently change model/runtime behavior in this auth PR.
- Practice coach and session POST handlers previously destructured null/non-object JSON. This patch adds object guards; coach also validates field types before calling the AI provider. Fifteen mocked route tests cover non-object JSON and invalid coach fields.
- Practice entitlement is enforced in the server-rendered practice page, but the authenticated session-write API does not repeat the free-session/subscription check. Test direct API access and mobile entitlement before changing product policy. A UI paywall is not an API permission boundary.
- `src/app/api/infra/error-boundary/route.ts` ignores the Supabase insert result's error and returns received=true. This can hide missing error persistence. Self-healing is explicitly unavailable on Vercel because its queue is filesystem-based.
- Production auth recovery needs a controlled test account and a real recovery link after preview deployment. Source and unit validation are not proof of delivered-email/PKCE behavior.
- Production billing/checkout, clinician assignments, recordings/storage, messages, account erasure and external-provider integrations need a dedicated non-destructive test plan. Never use a paid checkout or send a real message as a smoke test.
- Schema/history reconciliation and conversions are owned by separate changes and were not altered here.

## Evidence

Before screenshot: live dashboard request resolved to the login screen with its next destination. Implementation screenshot: branch package.json shows the corrected lint command. PR diff and raw branch byte verification document the auth changes. Screenshots are supporting evidence, not substitutes for test results.

## Training audio persistence follow-up

The audio upload handler previously returned ok=true even when the training_samples insert failed. It now fails honestly, checks idempotency lookup errors, cleans an unreferenced object after failed insertion and avoids deleting a concurrent committed sample or an unverifiable reference. Existing consent and session ownership checks are unchanged. Six mocked route tests cover these boundaries. The practice client still fire-and-forgets training uploads and ignores HTTP failures, so user-visible retry/status remains open. Cleanup failure logs an orphan warning; no existing production objects were deleted.
