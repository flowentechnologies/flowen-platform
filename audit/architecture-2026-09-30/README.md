# Flowen architecture audit - 30 September 2026

This is a first audit pass, not a declaration that the platform is bug-free. No production mutation, migration, tracking change or model training was performed. Merge and deployment require owner review.

## Inventory and coverage

- 124 Next.js page routes and 174 API routes inventoried from the fresh main checkout.
- Static literal page destinations checked against page routes: no unmatched destination found. Dynamic paths, anchor targets and authorization are separate checks and are not certified by this result.
- Existing unit suite: 253 tests in 34 files passed. Added 12 redirect tests: total 265 tests in 35 files passed.
- Auth/proxy changed files pass ESLint. Full-project lint and type/build checks are separate, not inferred from unit tests.
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
- Practice coach and session POST handlers parse JSON then destructure without guarding null or non-object payloads. Valid JSON `null` raises rather than returning the intended 400. Add request-shape validation and route tests in a separate patch.
- Practice entitlement is enforced in the server-rendered practice page, but the authenticated session-write API does not repeat the free-session/subscription check. Test direct API access and mobile entitlement before changing product policy. A UI paywall is not an API permission boundary.
- `src/app/api/infra/error-boundary/route.ts` ignores the Supabase insert result's error and returns received=true. This can hide missing error persistence. Self-healing is explicitly unavailable on Vercel because its queue is filesystem-based.
- Production auth recovery needs a controlled test account and a real recovery link after preview deployment. Source and unit validation are not proof of delivered-email/PKCE behavior.
- Production billing/checkout, clinician assignments, recordings/storage, messages, account erasure and external-provider integrations need a dedicated non-destructive test plan. Never use a paid checkout or send a real message as a smoke test.
- Schema/history reconciliation and conversions are owned by separate changes and were not altered here.

## Evidence

Before screenshot: live dashboard request resolved to the login screen with its next destination. Implementation screenshot: branch package.json shows the corrected lint command. PR diff and raw branch byte verification document the auth changes. Screenshots are supporting evidence, not substitutes for test results.
