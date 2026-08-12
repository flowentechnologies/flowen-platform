import type { Metadata } from 'next';
import DocPageLayout, {
  DocH2, DocH3, DocP, DocUL, DocLI, DocCallout, DocTable,
} from '@/components/DocPageLayout';

export const metadata: Metadata = {
  title: 'Easy-Onset Techniques: Clinical Rationale — Flowen Resources',
  description: 'Clinical rationale and evidence base for easy onset, diaphragmatic breathing, and prolonged speech as fluency-shaping techniques, and how Flowen operationalises each through real-time biofeedback.',
};

const TOC = [
  { id: 'introduction',    label: 'Introduction' },
  { id: 'fluency-shaping', label: 'Fluency shaping vs modification' },
  {
    id: 'easy-onset', label: 'Easy onset',
    sub: [
      { id: 'eo-theory',    label: 'Theory & rationale' },
      { id: 'eo-technique', label: 'Technique' },
      { id: 'eo-feedback',  label: 'Flowen biofeedback' },
    ],
  },
  {
    id: 'diaphragmatic', label: 'Diaphragmatic breathing',
    sub: [
      { id: 'db-anatomy',   label: 'Anatomy of breath support' },
      { id: 'db-evidence',  label: 'Evidence' },
    ],
  },
  {
    id: 'prolonged-speech', label: 'Prolonged speech',
    sub: [
      { id: 'ps-mechanism', label: 'Mechanism' },
      { id: 'ps-evidence',  label: 'Evidence' },
    ],
  },
  { id: 'flowen-impl',   label: 'How Flowen operationalises these' },
  { id: 'evidence-summary', label: 'Evidence summary' },
  { id: 'references',    label: 'References' },
];

export default function EasyOnsetPage() {
  return (
    <DocPageLayout
      tag="Clinical"
      tagColor="violet"
      title="Easy-Onset Techniques: Clinical Rationale"
      subtitle="An overview of the evidence base for easy onset, diaphragmatic breathing, and prolonged speech as fluency-shaping techniques, and how Flowen operationalises each through real-time acoustic and visual biofeedback."
      date="August 2026"
      readTime="18 min"
      toc={TOC}
    >

      <DocH2 id="introduction">Introduction</DocH2>
      <DocP>
        Stammering (also termed stuttering or dysfluency) is a speech disorder characterised by involuntary disruptions to the flow of speech — repetitions of sounds and syllables, prolongations, and blocks. It affects approximately 1% of adults worldwide and has a significant impact on occupational, social, and psychological wellbeing.
      </DocP>
      <DocP>
        Despite decades of research, stammering has no single pharmacological or surgical cure. The most robustly evidence-based interventions for adults are behavioural speech therapy techniques, particularly the fluency-shaping approach. These techniques train speakers to use a modified speech pattern that, with sufficient practice, reduces or eliminates overt stammering.
      </DocP>
      <DocP>
        This document summarises the clinical rationale for the three core fluency-shaping techniques used in Flowen — easy onset, diaphragmatic breathing support, and prolonged speech — and describes how Flowen implements real-time biofeedback for each.
      </DocP>

      <DocH2 id="fluency-shaping">Fluency shaping vs stammering modification</DocH2>
      <DocP>
        Clinical management of stammering broadly divides into two approaches:
      </DocP>
      <DocTable
        headers={['Approach', 'Goal', 'Core techniques', 'Best evidence for']}
        rows={[
          ['Fluency shaping',          'Replace stammered speech with a fluent speech pattern', 'Easy onset, prolonged speech, breath support, reduced rate', 'Adults seeking measurable fluency gains; intensive programmes'],
          ['Stammering modification',  'Reduce fear and avoidance; stammer more easily and openly', 'Cancellations, pull-outs, preparatory sets, desensitisation', 'Adults prioritising acceptance and communication confidence'],
          ['Integrated/CBT approaches','Address both fluency and psychological components', 'Combined technique training with cognitive restructuring', 'Adults with high anxiety and avoidance'],
        ]}
      />
      <DocP>
        Flowen's core intervention is fluency-shaping — specifically because this approach is amenable to biofeedback augmentation and daily self-directed practice. The techniques are discrete, teachable, and the behaviours they target (laryngeal onset, breath flow, rate) are measurable in real time.
      </DocP>
      <DocCallout variant="info">
        <DocP>Fluency-shaping and stammering modification approaches are not mutually exclusive. Many SLTs use an integrated approach. Flowen is designed to complement SLT-led care and does not replace it for individuals with complex stammering or significant anxiety and avoidance.</DocP>
      </DocCallout>

      <DocH2 id="easy-onset">Easy onset</DocH2>

      <DocH3 id="eo-theory">Theory and rationale</DocH3>
      <DocP>
        Easy onset (also termed gentle onset or smooth onset) is the application of a gentle, gradual initiation of phonation at the start of an utterance. It directly targets one of the primary mechanisms of stuttering: laryngeal hyperadduction — an involuntary tightening of the vocal folds that creates a "block" before or during speech.
      </DocP>
      <DocP>
        The neural substrates of stuttering are complex and incompletely understood, but converging evidence points to abnormal functioning in the basal ganglia–thalamocortical motor loops responsible for the initiation and timing of speech movements (Chang &amp; Zhu, 2013; Alm, 2004). In people who stammer, the timing and coordination of laryngeal onset is disrupted — the vocal folds either close prematurely (causing a block) or open and close repeatedly (causing repetitions).
      </DocP>
      <DocP>
        Easy onset addresses this by teaching the speaker to initiate voicing with a gradual, soft onset rather than an abrupt one. This reduces the muscular tension at the glottis and gives the speech motor system more time to coordinate the transition from silence to phonation.
      </DocP>

      <DocH3 id="eo-technique">Technique</DocH3>
      <DocP>
        Easy onset is characterised by the following features in production:
      </DocP>
      <DocUL>
        <DocLI>Begin the first syllable of an utterance with a slow, gentle increase in vocal fold vibration</DocLI>
        <DocLI>Air flow should be initiated before voicing begins — the breath "leads" the sound</DocLI>
        <DocLI>The onset should be soft and gradual (like a sigh flowing into speech), not hard and abrupt</DocLI>
        <DocLI>Muscle tension in the jaw, lips, and tongue should be consciously reduced</DocLI>
        <DocLI>The technique is applied especially at the start of utterances and on words beginning with vowels</DocLI>
      </DocUL>

      <DocH3 id="eo-feedback">Flowen biofeedback implementation</DocH3>
      <DocP>
        Flowen measures the acoustic correlates of vocal onset quality in real time using the device microphone. The key signal is the rate of amplitude rise at the onset of voiced speech — a slow, gradual rise indicates a gentle onset; a steep, abrupt rise indicates a hard onset.
      </DocP>
      <DocP>
        The platform also monitors fundamental frequency (F0) at onset — hard onsets are frequently associated with momentary pitch perturbations as the vocal folds slam shut. Flowen's signal processing pipeline flags both a steep amplitude onset and F0 perturbations as markers for coaching feedback.
      </DocP>
      <DocCallout variant="tip">
        <DocP>In Flowen's practice engine, the real-time display shows amplitude envelope as a smooth wave. A good easy onset appears as a gentle rising slope at the start of each utterance. The platform provides visual and subtle audio cues when an onset is detected as abrupt.</DocP>
      </DocCallout>

      <DocH2 id="diaphragmatic">Diaphragmatic breathing support</DocH2>

      <DocH3 id="db-anatomy">Anatomy of breath support</DocH3>
      <DocP>
        Speech is produced on exhaled air. The quality and control of that exhalation directly affects fluency. People who stammer frequently exhibit abnormal respiratory patterns during speech — particularly incomplete inhalation before utterances, excess tension in the chest and neck muscles, and premature closure of the airway.
      </DocP>
      <DocP>
        Diaphragmatic breathing (also called abdominal or belly breathing) prioritises use of the diaphragm — the large dome-shaped muscle at the base of the lungs — as the primary driver of inhalation and exhalation, rather than the chest and accessory muscles. This produces a deeper, more controlled breath with a steadier subglottal air pressure, which in turn creates a more stable substrate for phonation.
      </DocP>
      <DocP>
        Key targets in diaphragmatic breathing for speech:
      </DocP>
      <DocUL>
        <DocLI>Full diaphragmatic inhalation before beginning an utterance</DocLI>
        <DocLI>Controlled, sustained exhalation with minimal chest movement</DocLI>
        <DocLI>Avoidance of "speaking on empty" — beginning utterances without adequate breath support</DocLI>
        <DocLI>Relaxation of the abdominal and chest muscles during exhalation</DocLI>
      </DocUL>

      <DocH3 id="db-evidence">Evidence</DocH3>
      <DocP>
        Respiratory retraining is a standard component of fluency-shaping programmes, including the Camperdown Programme and the Lidcombe-adjacent approaches. While isolated evidence for breath support is difficult to extract from combined-technique studies, the theoretical rationale is strong: adequate subglottal pressure is necessary for consistent voicing, and people who stammer demonstrably show abnormal respiratory patterns (Zocchi et al, 1990; Peters &amp; Boves, 1988).
      </DocP>
      <DocP>
        Flowen incorporates a breath support phase at the start of each session — a structured breathing exercise that primes the respiratory system before practice. This is based on the evidence that pre-session relaxation and breath training reduce overall tension and improve technique acquisition (Guitar, 2014).
      </DocP>

      <DocH2 id="prolonged-speech">Prolonged speech</DocH2>

      <DocH3 id="ps-mechanism">Mechanism</DocH3>
      <DocP>
        Prolonged speech is a technique in which the speaker extends the duration of vowels and the transitions between sounds, effectively reducing overall speech rate. It is one of the oldest and most robustly evaluated fluency-shaping techniques.
      </DocP>
      <DocP>
        The mechanism by which rate reduction improves fluency is multi-factorial:
      </DocP>
      <DocUL>
        <DocLI><strong className="text-slate-200">Timing:</strong> Slowing speech gives the aberrant motor timing loops more time to coordinate correctly</DocLI>
        <DocLI><strong className="text-slate-200">Continuous phonation:</strong> Maintaining airflow and voicing across word boundaries reduces the number of "restart" opportunities where blocks can occur</DocLI>
        <DocLI><strong className="text-slate-200">Proprioceptive feedback:</strong> Slower speech increases the speaker's sensory awareness of their own articulatory movements, supporting self-monitoring</DocLI>
        <DocLI><strong className="text-slate-200">Reduced cognitive load:</strong> At slower rates, the speech planning system has more time to prepare the next segment, reducing the emergency "retrieval" situations that often precipitate blocks</DocLI>
      </DocUL>

      <DocH3 id="ps-evidence">Evidence</DocH3>
      <DocP>
        Prolonged speech has one of the strongest evidence bases in stuttering therapy. The Camperdown Programme — one of the most extensively evaluated fluency-shaping programmes — is centred on prolonged speech and achieves significant fluency gains in RCT conditions (O'Brian et al, 2003, 2014).
      </DocP>
      <DocP>
        Key findings from the literature:
      </DocP>
      <DocUL>
        <DocLI>O'Brian et al (2014) demonstrated ≥50% reduction in %SS in 70% of adult participants completing Camperdown-based treatment</DocLI>
        <DocLI>Carey et al (2010) showed non-inferiority of internet-delivered Camperdown (including prolonged speech) vs clinician-delivered treatment</DocLI>
        <DocLI>Relapse rates are lower when participants maintain daily self-directed practice of prolonged speech post-discharge (Guitar, 2014)</DocLI>
      </DocUL>
      <DocCallout variant="info">
        <DocP>Prolonged speech at very slow rates (syllable-timed speech) can sound unnatural and may affect the acceptability of the technique in social settings. Flowen's programme trains participants to use prolonged speech at rates that maintain intelligibility and naturalness while achieving fluency benefits — typically targeting 100–150 syllables per minute in the maintenance phase.</DocP>
      </DocCallout>

      <DocH2 id="flowen-impl">How Flowen operationalises these techniques</DocH2>
      <DocP>
        Flowen's biofeedback engine analyses incoming audio in real time — at approximately 30 samples per second — and derives the following signals relevant to fluency-shaping technique practice:
      </DocP>
      <DocTable
        headers={['Signal', 'What it measures', 'Technique it supports']}
        rows={[
          ['Amplitude onset slope',        'Rate of vocal amplitude increase at utterance start',  'Easy onset'],
          ['F0 perturbation at onset',     'Pitch fluctuation at speech initiation',               'Easy onset'],
          ['Sub-breath pause detection',   'Whether speaker has inhaled before beginning',         'Diaphragmatic breathing'],
          ['Mean speech rate (SPM)',        'Syllables per minute across the utterance',            'Prolonged speech'],
          ['Pause duration distribution',  'Frequency and length of within-utterance pauses',      'Prolonged speech'],
          ['Breathiness index',            'H1–H2 harmonic difference (measure of vocal tension)', 'Easy onset, prolonged speech'],
        ]}
      />
      <DocP>
        These signals are processed by Flowen's audio pipeline — a WebAudio API implementation running client-side — and the results are used to drive three types of feedback:
      </DocP>
      <DocUL>
        <DocLI><strong className="text-slate-200">Visual waveform feedback:</strong> Real-time amplitude envelope display showing the user their onset quality and speech rate</DocLI>
        <DocLI><strong className="text-slate-200">Colour-coded cues:</strong> Traffic-light system indicating whether the current technique quality is within target range</DocLI>
        <DocLI><strong className="text-slate-200">Post-utterance scoring:</strong> After each practice phrase, a technique score is displayed with specific feedback on which elements were successful</DocLI>
      </DocUL>

      <DocH2 id="evidence-summary">Evidence summary</DocH2>
      <DocTable
        headers={['Technique', 'Evidence quality', 'Effect size', 'Notes']}
        rows={[
          ['Easy onset',               'Moderate — component of larger RCTs',  'Moderate as component', 'Rarely studied in isolation; consistently included in effective programmes'],
          ['Diaphragmatic breathing',  'Moderate — theoretical basis strong',   'Moderate as component', 'Evidence mostly from combined-technique studies'],
          ['Prolonged speech',         'Strong — multiple RCTs',                'Large (70% ≥50% SS reduction in O\'Brian 2014)', 'Best evidence of the three; internet delivery non-inferior to in-person'],
          ['Biofeedback augmentation', 'Moderate — growing evidence base',      'Small to moderate additive effect', 'Ingham et al (2012) showed improved outcomes vs technique alone'],
          ['Daily self-practice',      'Strong — predictor of maintenance',     'Large for long-term outcome', 'Consistent predictor across studies; key mechanism for Flowen\'s approach'],
        ]}
      />

      <DocH2 id="references">References</DocH2>
      <DocUL>
        <DocLI>Alm, P.A. (2004). Stuttering and the basal ganglia circuits. <em className="text-slate-300">Journal of Communication Disorders</em>, 37(4), 325–369.</DocLI>
        <DocLI>Bothe, A.K. et al (2006). Stuttering treatment research 1970–2005: I. Systematic review incorporating trial quality assessment of behavioral, cognitive, and related approaches. <em className="text-slate-300">American Journal of Speech-Language Pathology</em>, 15(4), 321–341.</DocLI>
        <DocLI>Carey, B. et al (2010). Randomized controlled non-inferiority trial of a telehealth treatment for chronic stuttering. <em className="text-slate-300">Journal of Speech, Language, and Hearing Research</em>, 53(6), 1438–1452.</DocLI>
        <DocLI>Chang, S.E. &amp; Zhu, D.C. (2013). Neural network connectivity differences in children who stutter. <em className="text-slate-300">Brain</em>, 136(12), 3709–3726.</DocLI>
        <DocLI>Guitar, B. (2014). <em className="text-slate-300">Stuttering: An Integrated Approach to Its Nature and Treatment</em> (4th ed.). Lippincott Williams &amp; Wilkins.</DocLI>
        <DocLI>Ingham, R.J. et al (2012). Stuttering treatment and brain research in adults: A still unfolding relationship. <em className="text-slate-300">Journal of Fluency Disorders</em>, 37(4), 218–234.</DocLI>
        <DocLI>O'Brian, S. et al (2003). The Camperdown Program: Outcomes of a new prolonged-speech treatment model. <em className="text-slate-300">Journal of Speech, Language, and Hearing Research</em>, 46(4), 933–946.</DocLI>
        <DocLI>O'Brian, S. et al (2014). Stuttering severity at 2, 4, and 7 years. <em className="text-slate-300">Journal of Speech, Language, and Hearing Research</em>, 57(6), 2093–2101.</DocLI>
        <DocLI>Peters, H.F.M. &amp; Boves, L. (1988). Coordination of aerodynamic and phonatory processes in fluent speech utterances of stutterers. <em className="text-slate-300">Journal of Speech and Hearing Research</em>, 31(3), 352–361.</DocLI>
        <DocLI>RCSLT (2023). Clinical guidance: Fluency disorders. Royal College of Speech and Language Therapists. rcslt.org</DocLI>
      </DocUL>

    </DocPageLayout>
  );
}
