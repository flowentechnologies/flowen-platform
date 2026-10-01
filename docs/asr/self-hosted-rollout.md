# Self-hosted transcription rework

1 October 2026. Howard selected self-hosting and ruled out OpenAI service use. This draft changes transcription code only. No GPU endpoint or secret has been provisioned. Do not treat a recipe as deployed infrastructure.

## Default and interface

Modal L4, European Economic Area (`eu`), scale-to-zero, maximum one container and one inference per container is the initial deployment target. It matches our small inventory and keeps an owned Python worker, rather than a managed speech API. It is not selected because it is cheapest: Runpod's displayed 24GB class is cheaper, but is a GPU class, not a guaranteed L4. Modal's EU selection adds 15%, and plan eligibility must be verified before deployment. Region availability and processor terms remain gates.

`ASR_PROVIDER=modal` (default) or `runpod`; `ASR_ENDPOINT_URL` is the actual returned HTTPS worker URL; `ASR_ENDPOINT_KEY` is a randomly generated shared bearer secret of at least 32 characters, stored in both Vercel and worker secret storage. `ASR_MODEL=large-v3-turbo` (default) or English-only `distil-large-v3`; `ASR_LANGUAGE=en`; `ASR_TIMEOUT_MS=25000` (bounded to 1-30 seconds). `ASR_VOCABULARY_PROMPT` is optional, never a coaching script.

Vercel POSTs JSON `{audio: <base64 mono PCM16 WAV>, model, language, prompt}` to the worker; worker returns `{text}`. No user IDs, storage URLs or training data are included. The mobile response stays `{text}`. Endpoint configuration accepts only Modal `*.modal.run` or Runpod `*.api.runpod.ai`, no credentials/query/fragment/redirects. Missing or invalid configuration fails 503, upstream failure 502, request budget exceeded 429. No retries, shadow sends or fallback to OpenAI or another processor. Runpod uses a custom HTTP load-balancing worker with this contract, not the incompatible queue-based `/runsync` envelope; its deployment recipe remains to be validated separately.

`services/asr/modal_worker.py` is a reviewable deployment recipe with faster-whisper 1.2.1, L4, CUDA/cuDNN base, 30-second function timeout, zero minimum/one maximum containers, five-second scaledown window and one concurrent input. It uses memory-only audio, no URL fetching, no audio/transcript application logs, bounded requests and authenticated access. It disables VAD so it does not deliberately remove pauses. ASR may still delete repetitions: measure this before rollout. Dependencies/model revision and image digest must be locked and cached in a reviewed image before production. Current recipe's model alias can download mutable weights; it is intentionally not production-ready. Model provenance is upstream open-weights Whisper, not Flowen-trained ASR. Self-hosting uses no OpenAI API/key/account, but Whisper's upstream authorship remains OpenAI.

The on-device acoustic loop and browser Web Speech API are unchanged. Browser recognition may itself involve a browser vendor's processor. The Agora LLM/TTS route still contains OpenAI configuration on main and is separate unresolved work; this transcription PR is not a claim that all Flowen services are OpenAI-free.

## Cost picture: gross USD, no credits assumed

Observed official rates on 1 October 2026:

- Modal L4: $0.000222/GPU-second = $0.7992/GPU-hour.
- Modal physical CPU core: $0.0000131/core-second; memory $0.00000222/GiB-second.
- Our illustrative one-core/4-GiB worker: $0.00024398/active-second before region. Broad EU 1.15x gives **$0.000280577/active-second = $1.0100772/active-hour**. Model startup, inferences, configured warm window and any billed web-handler resources must be counted, not just audio duration. Model-storage/transfer/build charges and Vercel are separate.
- Modal Starter advertises $30 monthly compute and limited web functions, with region selection listed under Team. Team is $250/month with $100 compute credits. Do not assume EU deployment is available on a free account. Verify existing account tier, rate-card application and hosting quote first; a new Team plan would dominate this workload's compute cost and needs separate approval.
- Runpod 24GB serverless class previously displayed $0.69/worker-hour; its current pricing UI distinguishes active/flex. Reconfirm the **flex** quote at provisioning, do not treat $0.69 as guaranteed flex/L4 cost. Billing covers startup, execution and idle until full stop, rounded to seconds; storage additional. Dedicated $0.49/h in earlier eval is history, not a quote.

Inventory is 5 contributions/282 audio seconds/1 opted-in contributor from the earlier audit. This is not monthly transcription traffic or a licence to process it. No monthly request counter was verified. Expected monthly cost is therefore not knowable yet. If those five samples were processed once per month, using illustrative RTF 0.05-0.20 and five cold starts of 5-30s plus 5s warm tail per start, billed time is 64.1-231.4s and illustrative Modal EU compute is **$0.018-$0.065/month**, excluding storage, web-handler overhead, build, plan charges and Vercel. These startup/RTF assumptions are not measured benchmarks. Five minutes spread over nineteen 15s mobile chunks could create nineteen starts, costing more.

At 100 audio hours/month, RTF 0.05-0.20 gives **$5.05-$20.20 compute/month** before startup/tail and every other charge. Keeping this EU worker continuously warm for 720 hours would be about **$727.26/month compute**, so zero minimum workers matters. A function timeout limits a job, not total account spend. Global concurrency, usage alerts and a separate approved ceiling are still required.

Formula: `monthly active seconds = audio seconds * measured RTF + cold-start seconds + billed idle/tail seconds`; multiply by actual all-in rate and add plan/storage/network/build/API charges. Request logging must contain metadata only, not speech. Verify invoices/traffic before calling a number a forecast.

## Verification and merge gates

Local mocked tests cover endpoint allowlist, no OpenAI fallback, model/language restrictions, exact request/response contract, malformed/oversized responses, failures/timeouts and consent withdrawal/null/403 behaviour. No real speech is sent to a new processor.

Before merge or activation:

1. Approve actual host/region/account tier, DPA/subprocessors, request/log/back-up retention, deletion behaviour and a spending ceiling. No GPU provisioning or billed inference is authorised by this code change.
2. Pin runtime image digest, dependency closure and model revision; bake/cache weights. Validate CUDA load, memory, CPU allocation, true cancellation behaviour and health checks with synthetic/licensed audio.
3. Provision only after approval; store endpoint secret through secure secret storage. Verify Preview/Production URL and both Upstash credentials by name/presence only. Distributed rate limit remains 360 chunks/user/hour, not a global hard money cap.
4. Confirm staging is actually linked to isolated flowen-staging DB before synthetic consent/annotation tests. Earlier Preview used real production sample rows; do not mutate them.
5. Verify synthetic cold/warm provider endpoint smoke, web/mobile response contract, silence/repetition/hallucination accuracy, concurrency, real billed usage and deployment pixels. The mocked suite does not certify CUDA or provider deployment.
6. Keep PR draft. Its branch-only `git.deploymentEnabled=false` prevents unsolicited Vercel Preview builds; main and other branches remain enabled. Remove only the review-branch entry for an explicitly approved staged deployment. Rollback disables endpoint configuration and fails closed, never returns to OpenAI.

## Observed sources

- https://modal.com/pricing
- https://modal.com/docs/guide/region-selection
- https://modal.com/docs/guide/webhooks
- https://modal.com/docs/guide/concurrent-inputs
- https://docs.runpod.io/serverless/pricing
- https://www.runpod.io/pricing
- https://docs.runpod.io/serverless/load-balancing/overview
- https://github.com/SYSTRAN/faster-whisper
- https://huggingface.co/openai/whisper-large-v3-turbo
- https://vercel.com/docs/project-configuration/git-configuration
