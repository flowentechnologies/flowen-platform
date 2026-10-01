> 1 October update: Howard selected self-hosting, with no OpenAI service. The following is historical audit evidence. Superseding configuration/cost/merge gates: [self-hosted rollout](self-hosted-rollout.md). No OpenAI credential should be configured for transcription.

# ASR and dataset implementation review

30 September 2026. Review-only changes. Not a claim of a deployed or trained model.

## Audit evidence

Production ASR admin displayed a hard-coded flowen-asr-v1.0.2 model, 74M parameters, 0.856 macro F1 and A100 training history. Dataset admin displayed 103,847 clips, 823 hours and unsupported corpus versions/QA/language breakdown. In the same live page, the actual collection was five samples, 282 seconds, one opted-in user. `/api/admin/dataset` returned that small collection. Existing mobile code calls OpenAI whisper-1; the acoustic path is a separate on-device rule engine. No corresponding Flowen weights or training worker were found.

The revised pages remove those unsupported figures, corpus history, anonymity assertions and interactive diagrams that described an unimplemented model/training pipeline. Existing IP documents are not verified by this change and may still contain unsupported model/dataset assertions. They need their own evidence review; do not treat a legacy document as a benchmark.

## Implemented

- Runtime-grounded ASR status, explicit separation from fast acoustic feedback, deployment language/timeout/optional-vocabulary configuration.
- Separate paid-transcription rate budget of 360 requests/user/hour, distributed via existing Upstash configuration. Production without limiter credentials and limiter errors fail closed. No retry doubles provider spend.
- Strict base64 and mono PCM16 WAV chunk validation, bounded provider request timeout, no raw provider response logging. Default prompt no longer injects coaching phrases into transcription.
- Real paginated training-data collection and annotation queue. Missing database/schema/consent-query errors are not silently displayed as zero samples. Large-corpus duration totals are intentionally omitted rather than summing a capped database page.
- Existing opted-in practice contributions only. No new end-user or clinician contribution programme and no admin upload of someone else's speech.
- Current consent plus recorded collection consent required for transcript visibility, playback and annotation. No bulk audio export or storage paths/user IDs in listing. Playback links expire in 60 seconds, but are not revoked before expiry if consent changes meanwhile.
- Transcript and event annotation validation, timestamp bounds, conditional conflict detection and audit metadata without speech text. These edits do not prove expert QA or an immutable reviewed corpus.
- Self-hosting evaluation with observed vendor prices and clearly hypothetical throughput/cost scenarios. No provisioning, switch, training, GPU job or spend.

No ads/conversion logic, consent setting controls, migrations or fast acoustic loop changed.

## Verification

Local unit suite: 269 tests across 36 files pass, including 16 new config/dataset/API tests. Acoustic RuleEngine's 13 existing tests still pass. Scoped TypeScript passes for all touched routes/pages/libraries and dependencies. Full-repository TypeScript exceeded local memory/time limits; no full-repository pass claimed. No deployed end-to-end annotation or provider call test claimed.

After screenshots are actual source-rendered React components at desktop and 390px mobile width with mocked admin auth and dataset fetch. They use one synthetic fixture transcript, not private audio. They are labelled LOCAL REVIEW PREVIEW. Pixels were inspected for wrapping, readability, layout and controls. These previews do not include the full deployed admin shell or prove Production API/database behaviour.

### Desktop source previews

Uploaded screenshot filenames are assigned by the GitHub upload UI. The two PNGs in `evidence/` show the revised ASR status and dataset annotation queue. Mobile and live-before screenshots were retained separately for the review handoff. Do not present fixture counts/config status as live values.

## Merge/deploy gates

1. Verify `OPENAI_API_KEY`, `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are available in the intended environment. No secret values should appear in this PR or screenshots. Confirm the 360/hour budget fits actual chunk cadence and desired product allowance; it is a guardrail, not a pricing promise.
2. Run Preview build and authenticated read-only dataset tests. Exercise annotation success, conflict and withdrawal with synthetic/disposable opted-in test data, not real contributor speech. Verify actual `training_samples.disfluency_events` jsonb equality behaviour against the canonical schema before promotion.
3. Inspect full deployed admin layout on desktop/mobile. Do not call local component previews an end-to-end deployment check.
4. Merge remains with the owner. Nothing here is a live patch, database repair or model rollout.

## Still missing before real training

Approved contribution audience/data-processing scope; retention and withdrawal handling; durable reviewer/corpus/version history; speaker-isolated splits; model artifact registry; GPU trainer/job runner; held-out accuracy and device-latency benchmarks; host/processor terms and spending approval; model promotion and rollback. Existing annotation fields and audit log are useful prep, not a complete MLOps system.

A consent check immediately before access cannot make a multi-request storage/DB workflow atomic. For strong withdrawal guarantees, implement revocable authenticated streaming and a transaction-backed training manifest/consent exclusion gate. Never train from ordinary session recordings or from old exported links.
