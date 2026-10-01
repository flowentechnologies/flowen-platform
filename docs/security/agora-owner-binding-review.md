# Agora owner binding: review draft
1 October 2026. Base: 1ac5e34250059b11a4ec2dfa7c1ad17ce47be146.

Do not merge or deploy until owner approval and the verification gates below.

## Defect and patch
The former DELETE endpoint authenticated the caller but let them omit the optional channel check, or combine their own channel with another agent ID. It then issued a project-authorized provider DELETE. POST likewise accepted arbitrary client channel/token. Conflict retry trusted a provider error's agent ID without proving ownership.

The patch:
- derives the full-identity owner channel for both caller token and agent start;
- mints a separate server-side agent RTC token with the fixed bot UID, instead of reusing the caller's token;
- rejects supplied foreign channels, invalid body shapes, path-unsafe agent IDs, reserved caller UIDs and unexpected bot UIDs;
- proves an agent ID's membership using Agora's authoritative channel-filtered list before caller DELETE or conflict cleanup, including bounded pagination and fail-closed errors;
- uses the documented top-level meta.cursor; does not keep ownership in an ephemeral process cache or add a database migration;
- uses the full owner identity in the agent name, avoiding an 8-character prefix collision;
- sets request timeouts and validates the returned success ID.

Provider GETs used for owner checks are operational reads at deletion/conflict time, not a polling loop. No provider request was executed during development. The patch relies on the provider applying its documented channel filter; a malformed response, lookup outage, cursor cycle or pagination cap returns unavailable, never deletion.

## Verification performed locally
- 303 tests across 37 files pass, including 50 new tests for ownership, route authorization and RTC tokens. All external I/O mocked.
- Scoped ESLint passes for all changed TypeScript implementation/tests.
- Scoped TypeScript for changed implementation/tests and imported dependencies passes. Full repository typecheck exhausted local heap; no full pass claimed.
- No build, deployment, paid provider call, speech export, database change, live session stop or merge was performed.

## No-deploy review branch
`vercel.json` disables automatic Git deployments only for `review/agora-owner-binding`, per Vercel's git.deploymentEnabled contract. Other branches/main remain unchanged. Do not manually deploy this branch or remove that guard without renewed build/spend permission. GitHub tests are not a preview deployment.

## Required before merge/deployment
1. Confirm current Agora channel-filtered listing, states and meta pagination against synthetic agents in an approved isolated environment. Mocked API tests do not prove production provider behavior.
2. Test web and mobile start/stop, conflict/retry, omitted channel, foreign agent ID, lookup outage and multiple instances with synthetic test users, without acting on another person's real session.
3. Drain old-version sessions before rollout. Full-identity channels/names deliberately do not accept old truncated-prefix ownership. Old clients must reload/update; mixed-version stop requests are not authorized by guessing ownership. Plan controlled cleanup of legacy agents through operator authorization, not caller DELETE.
4. Keep draft until owner review. Entitlement/budget policy, audio lifecycle and the other architecture findings remain separate review work. This patch does not claim that these are fixed.

## Sources
- https://docs-md.agora.io/api/conversational-ai-api-v2.x.yaml (GET agents supports channel/state/from_time/limit/cursor; cursor is meta.cursor).
- https://vercel.com/docs/project-configuration/git-configuration (branch-specific git.deploymentEnabled).
