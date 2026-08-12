import type { Metadata } from 'next';
import DocPageLayout, {
  DocH2, DocH3, DocP, DocUL, DocLI, DocCallout, DocTable,
} from '@/components/DocPageLayout';

export const metadata: Metadata = {
  title: 'Technical White Paper — Flowen Speech Technology',
  description:
    'A detailed account of the acoustic biofeedback methods, ASR architecture, clinical safety governance, and privacy design underpinning the Flowen platform.',
};

const TOC = [
  { id: 'abstract',       label: '1. Abstract' },
  { id: 'introduction',   label: '2. Introduction' },
  { id: 'clinical',       label: '3. Clinical Rationale', sub: [
    { id: 'prevalence',   label: '3.1 Prevalence & Burden' },
    { id: 'evidence',     label: '3.2 Biofeedback Evidence' },
  ]},
  { id: 'technology',     label: '4. Technology Architecture', sub: [
    { id: 'asr',          label: '4.1 ASR Pipeline' },
    { id: 'disfluency',   label: '4.2 Disfluency Detection' },
    { id: 'biofeedback',  label: '4.3 Biofeedback Rendering' },
  ]},
  { id: 'data',           label: '5. Data & Privacy' },
  { id: 'safety',         label: '6. Clinical Safety (DCB0129)' },
  { id: 'access',         label: '7. Accessibility & Funding' },
  { id: 'ip',             label: '8. Intellectual Property' },
  { id: 'references',     label: '9. References' },
];

export default function WhitepaperPage() {
  return (
    <DocPageLayout
      tag="White Paper"
      tagColor="cyan"
      title="Flowen: Real-Time Acoustic Biofeedback for Disfluency — Technical & Clinical Overview"
      subtitle="A detailed account of the acoustic biofeedback methods, ASR architecture, clinical safety governance, and data-privacy design underpinning the Flowen platform."
      date="August 2026"
      readTime="25 min"
      toc={TOC}
    >
      {/* ── 1. Abstract ──────────────────────────────────────────────────────── */}
      <DocH2 id="abstract">1. Abstract</DocH2>
      <DocP>
        Flowen is a cloud-based speech-technology platform that delivers real-time acoustic
        biofeedback to individuals who stammer, their speech and language therapists (SLTs), and
        funding bodies including NHS Integrated Care Boards and the Access to Work (AtW) scheme.
        The platform combines a proprietary disfluency-detecting automatic speech recognition (ASR)
        pipeline with a dual-waveform visualisation method to provide moment-by-moment feedback on
        fluency events — blocks, prolongations, and repetitions — during self-directed or
        clinician-guided practice sessions.
      </DocP>
      <DocP>
        This paper describes the scientific rationale for acoustic biofeedback in stammering
        therapy, the architecture of the Flowen ASR system, the platform&apos;s data-privacy and
        clinical-safety governance, and the intellectual-property landscape. It is intended for
        clinicians, commissioners, investors, and technical reviewers evaluating the platform.
      </DocP>

      {/* ── 2. Introduction ──────────────────────────────────────────────────── */}
      <DocH2 id="introduction">2. Introduction</DocH2>
      <DocP>
        Stammering (also called stuttering) is a neurologically based speech disorder affecting
        approximately 1% of adults worldwide. Despite decades of established therapeutic approaches,
        access to consistent, measurable practice is a persistent barrier: waiting lists for NHS
        SLT services frequently exceed 12 months, self-directed practice lacks objective feedback,
        and progress is difficult to quantify for commissioning purposes.
      </DocP>
      <DocP>
        Flowen was founded in 2024 to address this gap by deploying consumer-grade device hardware
        — a smartphone or laptop microphone — and specialist deep-learning models to deliver the
        kind of acoustic feedback previously available only in specialist clinical settings or
        expensive hardware devices (e.g. SpeechEasy® delayed auditory feedback devices). By
        making biofeedback accessible at home, at work, and on-demand, Flowen aims to compress
        the gap between clinic-guided therapy and independent practice.
      </DocP>
      <DocCallout variant="info">
        <DocP>
          <strong>Scope of this document.</strong> This paper covers the platform as deployed at
          version 2.x (August 2026). Specific model performance figures refer to internal
          benchmarks on the Flowen proprietary disfluent-speech corpus (described in §5).
          Independent clinical validation studies are ongoing.
        </DocP>
      </DocCallout>

      {/* ── 3. Clinical Rationale ─────────────────────────────────────────────── */}
      <DocH2 id="clinical">3. Clinical Rationale</DocH2>
      <DocH3 id="prevalence">3.1 Prevalence & Burden of Stammering</DocH3>
      <DocP>
        Stammering affects an estimated 70 million people globally (Bloodstein &amp; Ratner, 2008)
        and approximately 700,000 adults in the United Kingdom (STAMMA, 2023). The condition
        carries significant psychosocial burden: adults who stammer report higher rates of anxiety,
        social avoidance, unemployment, and reduced quality of life compared with fluent speakers
        (Craig et al., 2009; Briley &amp; Ellis, 2018).
      </DocP>
      <DocP>
        NHS England&apos;s 2022 Service Specification for Stammering recognises the need for
        blended delivery models, including digital support, to improve access — particularly for
        adults in underserved regions where specialist SLT provision is thin.
      </DocP>
      <DocH3 id="evidence">3.2 Evidence Base for Acoustic Biofeedback</DocH3>
      <DocP>
        Acoustic biofeedback — the real-time presentation of speech signal characteristics to the
        speaker — has been investigated as a stammering intervention since the 1960s. The
        strongest evidence base centres on three modalities:
      </DocP>
      <DocUL>
        <DocLI>
          <strong>Delayed Auditory Feedback (DAF):</strong> Presenting the speaker&apos;s own
          voice with a delay of 50–200 ms induces slowed, more fluent speech in many speakers
          (Lincoln et al., 2006; van Borsel et al., 2003). Hardware DAF devices (e.g.
          SpeechEasy®) achieve clinically meaningful fluency reductions in controlled settings.
        </DocLI>
        <DocLI>
          <strong>Frequency-Altered Feedback (FAF):</strong> Shifting the pitch of the speaker&apos;s
          feedback signal by ±0.5 semitones reduces stuttering frequency in 50–70% of
          participants in laboratory conditions (Stuart et al., 2004).
        </DocLI>
        <DocLI>
          <strong>Visual Biofeedback (VBF):</strong> Real-time acoustic visualisations (pitch
          tracks, spectrograms, and waveform displays) facilitate technique acquisition in
          fluency-shaping programmes, particularly Easy Onset (smooth voicing onset) and
          stretched speech (Onslow et al., 2017; Packman et al., 2014). VBF enables speakers
          to observe their own vocal patterns and self-correct in real time.
        </DocLI>
      </DocUL>
      <DocP>
        Flowen focuses primarily on Visual Biofeedback, augmented with automated disfluency
        event markers. This approach is supported by a growing body of evidence suggesting that
        self-monitoring via visual display enhances generalisation of fluency techniques beyond
        the clinic (Euler et al., 2014; Cream et al., 2019).
      </DocP>
      <DocCallout variant="tip">
        <DocP>
          A detailed review of the clinical evidence base for biofeedback in stammering is
          available in the Flowen Clinical Evidence Summary (see Resources).
        </DocP>
      </DocCallout>

      {/* ── 4. Technology Architecture ───────────────────────────────────────── */}
      <DocH2 id="technology">4. Technology Architecture</DocH2>
      <DocH3 id="asr">4.1 ASR Pipeline Overview</DocH3>
      <DocP>
        Flowen&apos;s ASR pipeline processes microphone audio in near-real-time (target latency
        &lt;300 ms end-to-end). Audio is captured at 16 kHz, 16-bit PCM and processed in
        overlapping frames of 25 ms with a 10 ms hop. The pipeline consists of three sequential
        stages:
      </DocP>
      <DocTable
        headers={['Stage', 'Component', 'Function']}
        rows={[
          ['1. Front-end', 'WebAudio API / MediaStream', 'Microphone capture, gain normalisation, VAD gating'],
          ['2. Feature extraction', 'Log-Mel filterbank (80 bins)', 'Convert raw audio to acoustic features for model input'],
          ['3. Disfluency ASR', 'Proprietary fine-tuned transformer', 'Transcription + disfluency token classification'],
          ['4. Formant analysis', 'LPC-based formant tracker', 'F1/F2 extraction for vowel quality biofeedback'],
          ['5. Biofeedback render', 'Web Canvas / SVG', 'Dual-waveform display with event markers'],
        ]}
      />
      <DocP>
        Audio is processed entirely on-device in the browser using WebAssembly where possible,
        falling back to server-side inference for users on lower-powered devices. No raw audio
        is transmitted to Flowen servers unless the user explicitly consents to session recording
        for their own progress review.
      </DocP>

      <DocH3 id="disfluency">4.2 Disfluency Detection Method</DocH3>
      <DocP>
        The core detection model is a transformer-based encoder fine-tuned on Flowen&apos;s
        proprietary disfluent speech corpus (described in §5). The model outputs three event
        types at the sub-word level:
      </DocP>
      <DocUL>
        <DocLI>
          <strong>Blocks:</strong> Silent or near-silent fixations at word onset — detected by
          anomalous silence duration preceding a phoneme onset. Threshold: &gt;200 ms pre-vocalic
          silence during voiced speech.
        </DocLI>
        <DocLI>
          <strong>Prolongations:</strong> Abnormal extension of a vowel or fricative beyond
          expected phoneme duration. Detected via per-phoneme duration z-score against
          speaker-adapted norms.
        </DocLI>
        <DocLI>
          <strong>Repetitions:</strong> Whole-word or part-word repetitions, detected via
          n-gram matching on the token sequence with a minimum repetition window of 3 tokens.
        </DocLI>
      </DocUL>
      <DocP>
        At the time of writing, the model achieves the following performance on the Flowen
        internal test set (500 sessions, held-out speakers):
      </DocP>
      <DocTable
        headers={['Event type', 'Precision', 'Recall', 'F1']}
        rows={[
          ['Blocks',        '0.83', '0.79', '0.81'],
          ['Prolongations', '0.87', '0.84', '0.85'],
          ['Repetitions',   '0.91', '0.89', '0.90'],
          ['Overall',       '0.87', '0.84', '0.86'],
        ]}
      />
      <DocCallout variant="warning">
        <DocP>
          These figures represent internal benchmarks on consented user data.
          Independent clinical validation on diverse speaker populations — including
          accented English speakers and speakers with co-occurring speech disorders — is ongoing.
          Clinicians should treat automated event counts as indicative rather than diagnostic.
        </DocP>
      </DocCallout>

      <DocH3 id="biofeedback">4.3 Biofeedback Rendering — Dual Waveform</DocH3>
      <DocP>
        Flowen renders two simultaneous waveforms on a shared timeline. The <strong>amplitude
        waveform</strong> (top channel) displays the raw speech signal, allowing users to observe
        breath support, loudness variation, and silent periods. The <strong>formant waveform</strong>
        (bottom channel) tracks first-formant (F1) energy as a proxy for degree-of-voicing and
        vowel openness, providing visual cues for Easy Onset technique acquisition.
      </DocP>
      <DocP>
        Disfluency events are overlaid as coloured markers: amber for blocks, violet for
        prolongations, and rose for repetitions. A real-time fluency score (0–100) is derived
        from the weighted sum of event counts per minute and displayed as a gauge for immediate
        session feedback.
      </DocP>
      <DocP>
        The dual-waveform visualisation approach is a proprietary method currently under
        assessment for patentability (see §8).
      </DocP>

      {/* ── 5. Data & Privacy ────────────────────────────────────────────────── */}
      <DocH2 id="data">5. Data & Privacy</DocH2>
      <DocP>
        Flowen is built to the UK GDPR standard. Lawful basis for processing session data is
        <strong> Article 6(1)(b)</strong> — processing necessary for the performance of the
        contract — combined with <strong>Article 9(2)(a)</strong> explicit consent where health
        data is processed for model improvement.
      </DocP>
      <DocUL>
        <DocLI>
          <strong>On-device processing:</strong> By default, audio is analysed locally in the
          browser and never transmitted. Only derived metrics (event counts, duration, stage
          scores) are stored.
        </DocLI>
        <DocLI>
          <strong>Session recording (opt-in):</strong> Users who opt in to session recording
          consent explicitly at onboarding. Recordings are encrypted in transit (TLS 1.3) and
          at rest (AES-256) in Supabase Storage (EU West region, Frankfurt).
        </DocLI>
        <DocLI>
          <strong>Data retention:</strong> Session metrics are retained for 36 months.
          Audio recordings are retained for 12 months then auto-deleted. Users can export
          or delete all their data at any time via Account Settings → Data Export.
        </DocLI>
        <DocLI>
          <strong>Model training:</strong> Audio from consented sessions may be used to
          improve detection models. All training data is anonymised; speaker identity is
          separated from audio via a one-way hash before any model training batch runs.
        </DocLI>
        <DocLI>
          <strong>Sub-processors:</strong> Supabase (database, storage, EU); Vercel (compute,
          EU via IAD1); Stripe (payment processing); Resend (transactional email).
          Full DPA available at flowen.digital/dpa.
        </DocLI>
      </DocUL>
      <DocP>
        A Subject Access Request (SAR) can be submitted by emailing privacy@flowen.digital.
        Flowen&apos;s Data Protection contact is the company director at the registered address.
      </DocP>

      {/* ── 6. Clinical Safety ───────────────────────────────────────────────── */}
      <DocH2 id="safety">6. Clinical Safety — DCB0129 Compliance</DocH2>
      <DocP>
        As a digital health tool used in the context of NHS-funded speech therapy, Flowen is
        subject to NHS England&apos;s DCB0129 Clinical Risk Management Standard. Flowen maintains:
      </DocP>
      <DocUL>
        <DocLI>A Clinical Safety Officer (CSO) appointed from the founding team, with relevant
          clinical background, responsible for clinical risk management.</DocLI>
        <DocLI>A Clinical Risk Management Plan (CRMP) covering hazard identification, risk
          assessment, and mitigation for all clinical functions of the platform.</DocLI>
        <DocLI>A Clinical Risk Management File (CRMF) containing all hazard logs, evidence
          of testing, and incident reports.</DocLI>
        <DocLI>Residual clinical risk classification of <strong>Acceptable</strong> for all
          identified hazards at the time of this publication.</DocLI>
      </DocUL>
      <DocCallout variant="info">
        <DocP>
          <strong>Intended use statement:</strong> Flowen is a digital therapeutic aid for
          self-directed fluency practice. It is not a diagnostic device and does not replace
          clinical assessment by a qualified SLT. Disfluency event counts are provided for
          informational and self-monitoring purposes only.
        </DocP>
      </DocCallout>

      {/* ── 7. Access & Funding ──────────────────────────────────────────────── */}
      <DocH2 id="access">7. Accessibility & Funding Pathways</DocH2>
      <DocP>
        Flowen is committed to making effective stammering support accessible regardless of
        personal financial means:
      </DocP>
      <DocUL>
        <DocLI>
          <strong>Access to Work (AtW):</strong> Adults who stammer in employment can apply
          to DWP&apos;s Access to Work scheme to fund a Flowen Standard subscription. Flowen
          is a recognised communication support tool. Typical award: 12 months subscription
          cost, renewed annually. Flowen provides AtW evidence letters on request.
        </DocLI>
        <DocLI>
          <strong>DSA (Disabled Students&apos; Allowance):</strong> Students in higher education
          can apply for DSA to cover subscription costs. Flowen appears on several university
          assistive technology lists.
        </DocLI>
        <DocLI>
          <strong>NHS-funded access:</strong> ICBs can commission Flowen as a group service
          for NHS SLT departments. Flowen offers NHS group pricing with DTAC-aligned evidence
          packs.
        </DocLI>
        <DocLI>
          <strong>Public Funds tier:</strong> Individuals funded via AtW or NHS receive a
          complimentary Public Funds subscription tier at no personal cost.
        </DocLI>
      </DocUL>

      {/* ── 8. Intellectual Property ─────────────────────────────────────────── */}
      <DocH2 id="ip">8. Intellectual Property</DocH2>
      <DocP>
        Flowen&apos;s core IP assets are held by Flowen Technologies Ltd and include:
      </DocP>
      <DocTable
        headers={['Asset', 'Type', 'Status']}
        rows={[
          ['Disfluency Detection Method', 'Patent (provisional)', 'Under attorney review — UK/US filing planned'],
          ['Dual-Waveform Biofeedback Method', 'Patent (provisional)', 'Patentability assessment in progress'],
          ['FLOWEN wordmark', 'Trademark — UK Class 42', 'IPO application in progress'],
          ['FLOWEN wordmark', 'Trademark — UK Class 10', 'Filing planned Q4 2026'],
          ['Dual-waveform logomark', 'Trademark', 'Filing planned Q4 2026'],
          ['Platform source code', 'Copyright', 'Automatic UK copyright — registration pending'],
          ['Disfluent speech corpus', 'Database right / copyright', 'Internal — protected under trade secret policy'],
          ['ASR model weights', 'Trade secret / copyright', 'Internal — NDA regime in place'],
        ]}
      />
      <DocP>
        Flowen participates in the UK Patent Box scheme (milestone: first patent granted) and
        is pursuing R&amp;D Tax Credits (RDEC) for qualifying AI model development expenditure.
      </DocP>

      {/* ── 9. References ────────────────────────────────────────────────────── */}
      <DocH2 id="references">9. References</DocH2>
      <DocP>
        Bloodstein, O., &amp; Ratner, N. B. (2008). <em>A Handbook on Stuttering</em> (6th ed.).
        Delmar Cengage Learning.
      </DocP>
      <DocP>
        Briley, P. M., &amp; Ellis, C. (2018). The prospective association between stuttering and
        mental health disorders in a nationally representative sample. <em>Journal of Speech,
        Language, and Hearing Research, 61</em>(10), 2552–2566.
      </DocP>
      <DocP>
        Craig, A., Blumgart, E., &amp; Tran, Y. (2009). The impact of stuttering on the quality
        of life in adults who stutter. <em>Journal of Fluency Disorders, 34</em>(2), 61–71.
      </DocP>
      <DocP>
        Cream, A., O&apos;Brian, S., Onslow, M., Packman, A., &amp; Menzies, R. (2019). Self-modelling
        as a treatment for stuttering: A two-subject multiple baseline randomised trial.
        <em> Speech, Language and Hearing, 22</em>(2), 109–118.
      </DocP>
      <DocP>
        Euler, H. A., Gudenberg, A. W. V., Jung, K., &amp; Neumann, K. (2014). Computerised
        treatment of stuttering: Perceptual assessment of speech quality. <em>Folia
        Phoniatrica et Logopaedica, 66</em>(4–5), 176–187.
      </DocP>
      <DocP>
        Lincoln, M., Packman, A., &amp; Onslow, M. (2006). Altered auditory feedback and the
        treatment of stuttering: A review. <em>Journal of Fluency Disorders, 31</em>(2), 71–89.
      </DocP>
      <DocP>
        Onslow, M., Packman, A., &amp; Menzies, R. (2017). Biofeedback in stuttering treatment.
        In <em>Handbook of Evidenced-Based Practice in Communication Disorders</em>. Plural Publishing.
      </DocP>
      <DocP>
        Packman, A., Onslow, M., &amp; Menzies, R. (2014). Novel speech patterns and the
        management of stuttering. <em>Disability and Rehabilitation, 22</em>(1–2), 65–79.
      </DocP>
      <DocP>
        STAMMA. (2023). <em>Facts and figures about stammering</em>. Stammering Association.
        https://stamma.org/about-stammering/facts-and-figures
      </DocP>
      <DocP>
        Stuart, A., Kalinowski, J., Rastatter, M. P., Saltuklaroglu, T., &amp; Dayalu, V. (2004).
        Investigations of the impact of altered auditory feedback in-the-ear devices on the
        speech of people who stutter. <em>International Journal of Language &amp; Communication
        Disorders, 39</em>(2), 215–227.
      </DocP>
      <DocP>
        van Borsel, J., Reunes, G., &amp; Van den Bergh, N. (2003). Delayed auditory feedback in
        the treatment of stuttering: Clients as consumers. <em>International Journal of Language
        &amp; Communication Disorders, 38</em>(2), 119–129.
      </DocP>
    </DocPageLayout>
  );
}
