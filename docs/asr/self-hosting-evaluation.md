> 1 October update: Howard selected self-hosting, with no OpenAI service. The following is historical audit evidence. Superseding configuration/cost/merge gates: [self-hosted rollout](self-hosted-rollout.md). No OpenAI credential should be configured for transcription.

# Owning Flowen's speech stack

30 September 2026. Evaluation only: no infrastructure, spend or endpoint switch.

## Recommendation

Keep the fast acoustic detector on-device. Evaluate self-hosted **Whisper large-v3-turbo through faster-whisper/CTranslate2**, with **distil-large-v3** as an English-only challenger. Use a separate GPU service behind Flowen's authenticated Vercel API, not in the microphone/biofeedback loop. Self-hosting changes who operates transcription; it does not turn upstream weights into an original Flowen model or prove better accuracy, lower latency or cost.

Current repository path: web transcription uses browser speech recognition; mobile `/api/practice/asr` posts WAV chunks to OpenAI `whisper-1`. The acoustic pipeline uses AudioWorklet PCM frames and a rule engine. No registered fine-tuned model or training worker was found. Live dataset audit on this date found five stored contributions totalling 282 seconds. That is far too little evidence to promise a trained detector's accuracy.

## Candidates

| Candidate | Fit | Main caveat |
| --- | --- | --- |
| large-v3-turbo + faster-whisper | First evaluation candidate; multilingual transcription; smaller decoder than large-v3 | Accuracy on repetitions, blocks and prolonged speech must be tested, not inferred from general WER |
| distil-large-v3 + faster-whisper | English-only challenger; model card reports about 6x faster than large-v3 | Does not justify Welsh/Gaelic coverage; published speed is not Flowen device/server latency |
| Full large-v3 | Accuracy comparison baseline | More compute; do not assume the full model wins on disfluent speech |
| New general ASR from scratch | Not recommended at this stage | Dataset, training infrastructure and evaluation are missing; general ASR is different from detecting disfluency |

Whisper is not a real-time recogniser out of the box. Chunk buffering, upload, queueing, GPU inference and return all add latency. A 15-second flush interval alone dominates elapsed transcript availability. No hosted choice makes that a sub-80 ms transcription path.

## Infrastructure on the present stack

- **Vercel:** retain authentication, strict audio validation, per-user rate limits, request timeouts and provider adapter. Do not put model weights or GPU training in a Next.js function. Keep the client response contract `{text}` stable.
- **Supabase:** keep consented dataset metadata and private training-data storage. Ordinary session recordings remain out of scope. Training requires a versioned immutable manifest, speaker-isolated train/validation/test split, reviewer provenance, withdrawal exclusions and a processor/retention decision. Hashing a speaker ID does not anonymise voice.
- **Separate GPU host:** private authenticated HTTP worker/container, pinned weights/runtime, health checks, concurrency cap, bounded queue, no audio/transcript logs, ephemeral working files and explicit cleanup. Require region availability, DPA, subprocessors and backup/log retention review before uploading real speech.

| Host option | Observed price | Operational tradeoff |
| --- | --- | --- |
| Runpod Secure Cloud L4 dedicated pod | $0.49/GPU-hour | Warm worker avoids model cold starts, but pays for idle time; verify regional availability and actual instance/storage quote |
| Runpod serverless 24 GB class (L4/A5000/3090/MIG) | $0.69/worker-hour displayed | Class pricing is not a guarantee of a particular GPU; billed startup, execution and idle timeout, with storage additional |
| Modal L4 | $0.000222/second = $0.7992/GPU-hour | Convenient container scaling; CPU and memory costs are additional. Region/data-governance fit still needs verification |

Prices were read from vendor pages on this date. They are planning inputs, not a checkout quote or permission to spend. Runpod's default spend limit is not an appropriate Flowen budget. No hosting account or data residency was verified here.

## Cost per audio hour: calculated scenarios, not measured forecasts

`GPU cost/audio-hour = GPU price/hour × real-time factor / utilisation`, plus CPU, memory, storage, network, startup and idle charges. RTF is inference wall time divided by audio duration. Vendor runtime benchmarks use other audio/hardware and cannot establish Flowen's RTF.

At illustrative RTF 0.05–0.20 and 100% active utilisation:

| GPU rate | GPU-only cost per audio hour |
| --- | --- |
| Runpod dedicated L4 $0.49/h | $0.0245–$0.098 |
| Runpod serverless class $0.69/h | $0.0345–$0.138 |
| Modal L4 $0.7992/h | $0.03996–$0.15984 |

These exclude every non-GPU cost and cold-start overhead. At only 10% utilisation a dedicated GPU's effective cost is ten times the active-work figure. Keeping a $0.49/h GPU warm for a 30-day month costs $352.80 before other charges; at 100 audio hours/month that is $3.528/audio-hour regardless of attractive inference throughput. Scale-to-zero can suit low volume but cold-start latency must be accepted and measured.

The current OpenAI invoice/account rate was not verified. Compare against actual billed ASR spend and minutes from Flowen before claiming savings. Do not promise a cheaper service solely from theoretical GPU throughput.

## Expected latency and benchmark plan

There is no measured Flowen self-hosted latency yet. Treat 0.05–0.20 RTF only as sensitivity inputs. On a 15-second chunk that corresponds to 0.75–3 seconds of **inference only**, not end-to-end time. Capture buffer, upload, queue and cold start can exceed it. The faster-whisper repository publishes faster large-v2/distilled-model throughput on an RTX 3070 Ti; those figures do not benchmark turbo on an L4 or this dataset.

1. Use synthetic/licensed test audio first, not private user speech, to prove API and resource controls.
2. Approve data use and collect a representative, explicitly consented labelled evaluation set: accent, noise, mic/device, pause, repetition, prolongation and severity strata. Split by speaker. Preserve repetitions in references; normal ASR text normalisation can conceal the exact signal Flowen needs.
3. Measure WER plus repetition deletion, pause/timestamp preservation, hallucination on silence, failure rate, GPU memory and per-audio-hour cost. Measure warm and cold p50/p95/p99 from the client, at realistic concurrency, including upload/queue time.
4. Keep disfluency event precision/recall and acoustic-loop device latency as separate acceptance tests. Do not use transcription WER as detector accuracy.
5. Only select a model/runtime after the benchmark. Document the observed tradeoffs and a reviewable accuracy/latency/cost gate; no fabricated target becomes a measured result.

## Migration and ownership path

1. Add a provider interface behind the current API, default still `whisper-1`. Verify output compatibility, limits, timeout, monitoring and secret management before switch.
2. Provision only after owner approves host, region/processor terms and spending ceiling. Store worker secrets in deployment secret storage; never send direct GPU credentials to clients.
3. Shadow tests require separate approval before sending real speech to a new processor. Never double-send audio silently. Prefer offline approved evaluation first.
4. Roll out an opt-in/internal cohort with explicit rollback and a strict bounded queue. Avoid automatic fallback to a different processor unless that disclosure and transfer is approved.
5. Keep the acoustic detector unchanged. Evaluate a separate disfluency model using event-labelled audio once dataset provenance and the trainer exist. Version dataset, weights, metrics and manifests together; require reviewed promotion, rollback and withdrawal impact decisions.

A truthful claim after self-hosting would be: “Flowen operates transcription using open-weights Whisper and its own acoustic biofeedback pipeline.” “Flowen-trained disfluency model” requires actual trained weights, documented rights and held-out measurements. The legacy admin's 74M/F1/823-hour history is not evidence to preserve or recreate numerically.

## Sources

- OpenAI/Hugging Face turbo model card: https://huggingface.co/openai/whisper-large-v3-turbo . Pruned decoder, speed/quality caveats, real-time limitations. This card reports >5M training hours for the later model; do not reuse the original 680k-hours figure as its training size.
- Distil-Whisper model card: https://huggingface.co/distil-whisper/distil-large-v3 . English scope, speed and published WER results.
- faster-whisper implementation and benchmarks: https://github.com/SYSTRAN/faster-whisper . CTranslate2, quantisation, hardware/beam/batching caveats and VAD behaviour. Disabling/removing silence can harm pause-based downstream analysis.
- Runpod vendor pricing: https://www.runpod.io/pricing . Dedicated L4 and displayed serverless class rates.
- Runpod billing documentation: https://docs.runpod.io/serverless/pricing . Startup/execution/idle billing and storage charges.
- Modal vendor pricing: https://modal.com/pricing . L4 per-second GPU rate and separate CPU/memory pricing.
- Vercel function limits: https://vercel.com/docs/functions/limitations . Request payload/runtime limits; Vercel remains the API layer, not the model host.

Model cards and runtime benchmarks are source claims, not independent validation on Flowen users. Costs above are arithmetic scenarios. Data residency, actual provider bills and benchmark results remain unresolved.
