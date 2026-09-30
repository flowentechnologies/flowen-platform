# Deployed verification gates

30 September 2026. PR85 remains draft; not merge-ready.

- Vercel Preview deployment `BQ5R7Y5FZFEZwULXFfa7oQ6CwoPM`, head `279791d`, reached Ready in 43 seconds. Detail: https://vercel.com/flowen-technologies-speech/flowen-app/BQ5R7Y5FZFEZwULXFfa7oQ6CwoPM . Resolved application: https://flowen-ky7aqwxv7-flowen-technologies-speech.vercel.app/ . Later annotation-schema correction requires a fresh Preview check.
- Authenticated deployed ASR and training-dataset pages load correctly. Full admin shell inspected at desktop and 390px mobile. Dataset mobile heading, queue, textareas and Save button wrap/read properly; no horizontal page overflow (390px document at 390px viewport). No real audio played or annotation submitted.
- Provider/limiter gate FAILS: deployed ASR status reports missing provider credential and distributed limiter. Vercel project plus linked Shared searches with All Environments, All Types and All Variables return no `OPENAI_API_KEY` or `UPSTASH` rows. Names only were inspected; no secret values revealed or changed. No Preview/Production provider/rate-limit presence can be claimed.
- Synthetic-data annotation/withdrawal/conflict integration gate is BLOCKED: authenticated Preview displays the same five real sample IDs/dates and one contributor as Production. No isolated database or disposable test fixture was verified. Real contributors' speech and consent were not modified to simulate tests. An isolated test DB/fixture account is needed.
- Deployed read-only event inspection found real event fields use `onset_ms`, not `ts_ms`. Validator and interface example were corrected to match that schema, with regression coverage. No database value was changed.
- Existing local suite remains 269 tests; focused new API/config tests pass, scoped TypeScript passes. Earlier remote CI head passed full TypeScript and unit tests. Recheck remote CI and Preview for the final corrected head.

Missing credentials and isolated test infrastructure are blockers to honest merge-ready status, not a reason to provision services, spend money or run withdrawal tests on a real user without approval.
