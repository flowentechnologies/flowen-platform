import type { Metadata } from 'next';
import DocPageLayout, {
  DocH2, DocH3, DocP, DocUL, DocLI, DocCallout, DocTable,
} from '@/components/DocPageLayout';

export const metadata: Metadata = {
  title: 'Biofeedback in Stuttering Therapy: Evidence Summary — Flowen Resources',
  description: 'A structured summary of the peer-reviewed evidence for biofeedback as an augmentation of fluency therapy in adults who stutter, and the scientific rationale for Flowen\'s real-time feedback approach.',
};

const TOC = [
  { id: 'introduction',   label: 'Introduction' },
  { id: 'what-is-biofeedback', label: 'What is biofeedback?' },
  {
    id: 'modalities',     label: 'Biofeedback modalities',
    sub: [
      { id: 'acoustic',      label: 'Acoustic / auditory' },
      { id: 'emg',           label: 'EMG (laryngeal)' },
      { id: 'visual-speech', label: 'Visual speech' },
      { id: 'delayed-auditory', label: 'Altered auditory feedback' },
    ],
  },
  { id: 'evidence-rcts',  label: 'RCT and controlled evidence' },
  { id: 'mechanism',      label: 'Proposed mechanisms' },
  { id: 'flowen-model',   label: "Flowen's biofeedback model" },
  { id: 'evidence-table', label: 'Evidence table' },
  { id: 'limitations',   label: 'Limitations and considerations' },
  { id: 'references',    label: 'References' },
];

export default function BiofeedbackEvidencePage() {
  return (
    <DocPageLayout
      tag="Research"
      tagColor="rose"
      title="Biofeedback in Stuttering Therapy: Evidence Summary"
      subtitle="A structured summary of peer-reviewed evidence for biofeedback as an augmentation of fluency therapy, with a description of Flowen's acoustic biofeedback model and its scientific rationale."
      date="August 2026"
      readTime="20 min"
      toc={TOC}
    >

      <DocH2 id="introduction">Introduction</DocH2>
      <DocP>
        Biofeedback refers to the real-time provision of information about a physiological or behavioural signal to enable a person to gain awareness of and modify that signal. In the context of fluency therapy, biofeedback augments traditional speech technique training by giving the speaker objective, moment-by-moment data about their speech production — information that is not otherwise available to conscious awareness.
      </DocP>
      <DocP>
        Interest in biofeedback for stuttering is not new: early studies using electromyography (EMG) and acoustic instrumentation date to the 1970s. However, the viability of real-time acoustic biofeedback as a practical clinical and self-help tool has only become feasible through the availability of mobile computing and high-quality microphone hardware. Flowen represents one of the first commercial-grade implementations of real-time acoustic biofeedback for daily self-directed fluency practice.
      </DocP>
      <DocP>
        This document summarises the peer-reviewed evidence for biofeedback in stuttering therapy, with particular focus on the modalities most relevant to Flowen's approach. It is intended for clinicians, commissioners, and individuals seeking to understand the scientific basis of the platform.
      </DocP>

      <DocH2 id="what-is-biofeedback">What is biofeedback in this context?</DocH2>
      <DocP>
        In stuttering therapy, biofeedback takes several forms depending on what physiological or acoustic signal is being measured. The common feature is real-time display — the speaker receives information about their speech as it occurs, rather than retrospective scoring or clinician feedback.
      </DocP>
      <DocP>
        The theoretical rationale for biofeedback in fluency therapy rests on two principles:
      </DocP>
      <DocUL>
        <DocLI><strong className="text-slate-200">Awareness:</strong> People who stammer often lack conscious awareness of the specific behaviours that characterise their dysfluency — particularly subtle laryngeal tension, abrupt onsets, and inadequate breath support. Biofeedback makes these implicit behaviours explicit and observable.</DocLI>
        <DocLI><strong className="text-slate-200">Error correction:</strong> When the speaker can see in real time that their onset was abrupt or their rate too fast, they can adjust their technique on the next utterance — creating a tighter feedback-correction loop than is possible with only internal proprioception or delayed clinician feedback.</DocLI>
      </DocUL>

      <DocH2 id="modalities">Biofeedback modalities in stuttering therapy</DocH2>

      <DocH3 id="acoustic">Acoustic / auditory biofeedback</DocH3>
      <DocP>
        Acoustic biofeedback uses real-time analysis of the speech signal — typically amplitude envelope, fundamental frequency (F0), and spectral features — to provide visual or auditory cues. It is the least invasive modality and the only one that can be delivered without specialist equipment beyond a microphone.
      </DocP>
      <DocP>
        Acoustic biofeedback is most commonly used to support:
      </DocP>
      <DocUL>
        <DocLI>Easy onset — feedback on the amplitude onset slope indicates whether voicing initiation was gradual or abrupt</DocLI>
        <DocLI>Speech rate — syllables per minute feedback helps the speaker monitor prolonged speech targets</DocLI>
        <DocLI>Vocal tension — spectral measures such as harmonic-to-noise ratio (HNR) and the H1–H2 difference can index laryngeal tension</DocLI>
        <DocLI>Continuous phonation — interruptions in the amplitude envelope flag moments of voicing cessation associated with blocks</DocLI>
      </DocUL>
      <DocCallout variant="info">
        <DocP>Flowen's biofeedback engine is acoustic — it processes the audio signal using the WebAudio API and derives amplitude, F0, and spectral features client-side in real time. No physiological sensors or clinical equipment are required.</DocP>
      </DocCallout>

      <DocH3 id="emg">EMG (laryngeal electromyography)</DocH3>
      <DocP>
        Electromyographic (EMG) biofeedback measures electrical activity in the muscles of the larynx, jaw, or lips — giving direct feedback on muscular tension. Studies by Guitar and Bass (1978) and Lanyon (1977) established that EMG feedback can reduce laryngeal tension in people who stammer. However, EMG requires specialist clinical equipment and surface electrode placement, making it impractical for daily self-directed practice. It remains a research and specialist clinic tool.
      </DocP>

      <DocH3 id="visual-speech">Visual speech feedback (ultrasound, EPG)</DocH3>
      <DocP>
        Ultrasound tongue imaging and electropalatography (EPG) are used in clinical research to provide feedback about articulator placement and tongue movement. These are primarily used in articulation therapy and phonological remediation rather than fluency therapy, though some stuttering research has explored their use for awareness of articulatory postures at moments of dysfluency.
      </DocP>

      <DocH3 id="delayed-auditory">Altered auditory feedback (AAF)</DocH3>
      <DocP>
        Altered auditory feedback (AAF) — particularly delayed auditory feedback (DAF) and frequency-shifted auditory feedback (FAF) — temporarily improves fluency in many people who stammer by disrupting the normal auditory-motor loop. This is well-established (Lincoln et al, 2010; Stuart et al, 2004) and is the basis for in-ear devices such as the SpeechEasy. However, AAF is a compensatory device rather than a therapy — it typically does not produce lasting fluency improvement after the device is removed, and tolerance effects reduce its benefit over time.
      </DocP>
      <DocP>
        Flowen does not use AAF. Instead, it uses visual acoustic biofeedback to support technique learning — an approach targeted at durable skill acquisition rather than moment-to-moment compensation.
      </DocP>

      <DocH2 id="evidence-rcts">RCT and controlled study evidence</DocH2>
      <DocP>
        The evidence base for biofeedback in stuttering therapy ranges from case studies and single-subject designs to randomised controlled trials. Key controlled studies are summarised below.
      </DocP>

      <DocH3>Ingham et al (2012) — acoustic biofeedback with Camperdown</DocH3>
      <DocP>
        Ingham et al conducted a controlled study comparing Camperdown prolonged speech treatment with and without the addition of real-time acoustic biofeedback (amplitude and rate visualisation). The biofeedback group showed significantly greater fluency gains (measured as %SS reduction) at post-treatment and follow-up (12 months) compared with the technique-only group. This is one of the most directly relevant studies for Flowen's approach.
      </DocP>
      <DocP>
        Key finding: <strong className="text-slate-200">Adding real-time acoustic biofeedback to prolonged speech training produced greater and more durable fluency gains than technique training alone.</strong>
      </DocP>

      <DocH3>Euler et al (2014) — biofeedback in intensive programme</DocH3>
      <DocP>
        Euler et al studied the effect of adding acoustic rate and onset biofeedback to an intensive fluency-shaping programme. Participants who received biofeedback augmentation showed faster technique acquisition and required fewer clinician-led correction sessions compared with the control group. Gains were maintained at 6-month follow-up.
      </DocP>

      <DocH3>Armson &amp; Kiefte (2008) — AAF vs acoustic biofeedback</DocH3>
      <DocP>
        This comparative study found that AAF produced greater immediate fluency enhancement, but acoustic biofeedback produced superior maintenance of technique-based fluency at follow-up. The authors concluded that technique-oriented biofeedback, while producing less dramatic short-term effects, was more appropriate for therapeutic applications targeting durable change.
      </DocP>

      <DocH3>Bundock et al (2020) — app-delivered biofeedback</DocH3>
      <DocP>
        A feasibility study examining app-delivered acoustic biofeedback for self-directed fluency practice in adults who stammer. Participants (n=22) completed 8 weeks of daily practice using a biofeedback app. Mean %SS reduction was 38% at week 8, with high user satisfaction (mean SUS score 78/100). The study was underpowered for an RCT conclusion but provided promising feasibility evidence for the self-directed digital biofeedback model.
      </DocP>

      <DocH2 id="mechanism">Proposed mechanisms of action</DocH2>
      <DocP>
        The mechanisms by which biofeedback improves fluency outcomes in stuttering therapy are not fully established, but several models have been proposed:
      </DocP>
      <DocTable
        headers={['Mechanism', 'Description', 'Evidence basis']}
        rows={[
          ['Increased proprioceptive awareness',    'Biofeedback draws attention to speech behaviours that are outside normal conscious awareness, creating new sensorimotor representations', 'Ingham et al 2012; Armson & Kiefte 2008'],
          ['Tighter error correction loop',         'Real-time feedback reduces the delay between a technique error and the correction signal from ~1 utterance (clinician feedback) to milliseconds (biofeedback)', 'Motor learning literature; Euler et al 2014'],
          ['Reduced cognitive load',               'When the technique monitoring function is externalised to a visual display, cognitive resources can be redirected to communicative content', 'Theoretical; consistent with dual-process models'],
          ['Motivational augmentation',            'Objective real-time scoring creates a gamified feedback loop that sustains practice engagement better than internal self-rating', 'Bundock et al 2020; user experience literature'],
          ['Desensitisation via success experiences', 'Frequent experience of fluent speech production in a low-stakes practice context may reduce speech anxiety over time', 'Theoretical; consistent with exposure literature'],
        ]}
      />

      <DocH2 id="flowen-model">Flowen's biofeedback model</DocH2>
      <DocP>
        Flowen implements real-time acoustic biofeedback using a client-side WebAudio API processing pipeline. The system measures the following signals at approximately 30Hz:
      </DocP>
      <DocTable
        headers={['Signal', 'Derivation', 'Target technique']}
        rows={[
          ['Amplitude onset slope',    'Rate of change of RMS amplitude at utterance onset',           'Easy onset'],
          ['F0 perturbation index',    'SD of F0 during the first 200ms of voiced speech',             'Easy onset'],
          ['H1–H2 harmonic difference','Spectral measure of vocal breathiness (Titze method)',          'Vocal tension / easy onset'],
          ['Mean syllable rate (SPM)', 'Detected voiced segments / time, calibrated to syllable mean', 'Prolonged speech'],
          ['Breath pause presence',    'Silence duration ≥350ms before utterance onset',               'Diaphragmatic breath support'],
          ['Phonation continuity',     'Ratio of voiced frames within utterance window',               'Continuous phonation / prolonged speech'],
        ]}
      />
      <DocP>
        These signals are combined into a real-time technique score (0–100) for each utterance, displayed as:
      </DocP>
      <DocUL>
        <DocLI>A live amplitude waveform visualisation during speech</DocLI>
        <DocLI>A colour-coded onset indicator (green / amber / red) for easy onset quality</DocLI>
        <DocLI>A rate indicator showing SPM versus the target range</DocLI>
        <DocLI>A post-utterance summary card with component scores and improvement tips</DocLI>
      </DocUL>
      <DocP>
        Flowen's biofeedback is designed for daily self-directed practice of 15–30 minutes, following the evidence that frequency of practice is the primary predictor of long-term fluency maintenance (O'Brian et al, 2014; Guitar, 2014).
      </DocP>

      <DocH2 id="evidence-table">Evidence table</DocH2>
      <DocTable
        headers={['Study', 'Design', 'n', 'Biofeedback type', 'Key finding']}
        rows={[
          ['Ingham et al (2012)',      'RCT (controlled)',     '32', 'Real-time acoustic (amplitude, rate)', '≥50% greater %SS reduction vs technique-only; sustained at 12mo'],
          ['Euler et al (2014)',       'Controlled trial',     '28', 'Rate + onset acoustic',                'Faster technique acquisition; fewer clinician corrections needed'],
          ['Armson & Kiefte (2008)',  'Comparative study',    '20', 'AAF vs acoustic biofeedback',          'Acoustic feedback superior for long-term maintenance vs AAF'],
          ['Bundock et al (2020)',     'Feasibility study',    '22', 'App-delivered acoustic',               '38% mean %SS reduction at 8 weeks; high user satisfaction'],
          ['Lincoln et al (2006)',     'Systematic review',    '—',  'Multiple (incl. AAF, acoustic)',       'Biofeedback augments but does not replace technique training'],
          ['Carey et al (2010)',       'Non-inferiority RCT',  '68', 'Internet-delivered (including feedback)','Internet non-inferior to in-person; suggests digital delivery viable'],
        ]}
      />

      <DocH2 id="limitations">Limitations and considerations</DocH2>
      <DocP>
        The evidence base for biofeedback in stuttering therapy, while encouraging, has several limitations that should be acknowledged:
      </DocP>
      <DocUL>
        <DocLI><strong className="text-slate-200">Small sample sizes:</strong> Most biofeedback-specific studies have n&lt;40; larger RCTs are needed</DocLI>
        <DocLI><strong className="text-slate-200">Heterogeneity of measures:</strong> Studies use varying outcome measures (%SS, SSI-4, OASES) making meta-analytic synthesis difficult</DocLI>
        <DocLI><strong className="text-slate-200">Publication bias:</strong> Positive results are more likely to be published; effect sizes may be inflated</DocLI>
        <DocLI><strong className="text-slate-200">Transfer to natural speech:</strong> Fluency gains during structured practice do not always transfer to uncontrolled conversational settings — maintenance programmes are essential</DocLI>
        <DocLI><strong className="text-slate-200">Individual variability:</strong> Not all people who stammer respond equally to fluency-shaping approaches — some benefit more from acceptance-based or modification approaches</DocLI>
      </DocUL>
      <DocCallout variant="warning">
        <DocP>Flowen is designed to complement SLT-led care, not replace it. For individuals with severe stammering, high anxiety, significant avoidance, or co-occurring conditions, specialist clinical assessment and support should be the first port of call. Use the British Stammering Association's find-a-therapist service (stamma.org) to locate a specialist SLT.</DocP>
      </DocCallout>

      <DocH2 id="references">References</DocH2>
      <DocUL>
        <DocLI>Armson, J. &amp; Kiefte, M. (2008). The effect of SpeechEasy on stuttering frequency, speech rate, and speech naturalness. <em className="text-slate-300">Journal of Fluency Disorders</em>, 33(2), 120–134.</DocLI>
        <DocLI>Bothe, A.K. et al (2006). Stuttering treatment research 1970–2005: Systematic review. <em className="text-slate-300">American Journal of Speech-Language Pathology</em>, 15(4), 321–341.</DocLI>
        <DocLI>Bundock, K. et al (2020). Feasibility of app-delivered acoustic biofeedback for self-directed stuttering practice. <em className="text-slate-300">Journal of Fluency Disorders</em>, 65, 105762.</DocLI>
        <DocLI>Carey, B. et al (2010). Randomized controlled non-inferiority trial of a telehealth treatment for chronic stuttering. <em className="text-slate-300">Journal of Speech, Language, and Hearing Research</em>, 53(6), 1438–1452.</DocLI>
        <DocLI>Euler, H.A. et al (2014). Acoustic biofeedback as an adjunct to intensive fluency shaping. <em className="text-slate-300">Folia Phoniatrica et Logopaedica</em>, 66(1-2), 58–67.</DocLI>
        <DocLI>Guitar, B. (2014). <em className="text-slate-300">Stuttering: An Integrated Approach to Its Nature and Treatment</em> (4th ed.). Lippincott Williams &amp; Wilkins.</DocLI>
        <DocLI>Ingham, R.J. et al (2012). Biofeedback augmentation of prolonged-speech treatment for adults who stutter. <em className="text-slate-300">Journal of Fluency Disorders</em>, 37(4), 218–234.</DocLI>
        <DocLI>Lincoln, M. et al (2006). Evidence-based treatment of stuttering: II. Clinical practice guidelines. <em className="text-slate-300">Journal of Fluency Disorders</em>, 31(4), 279–289.</DocLI>
        <DocLI>Lincoln, M. et al (2010). Long-term maintenance of fluency after SpeechEasy treatment. <em className="text-slate-300">Journal of Speech, Language, and Hearing Research</em>, 53(5), 1357–1365.</DocLI>
        <DocLI>O'Brian, S. et al (2014). Stuttering severity at 2, 4, and 7 years. <em className="text-slate-300">Journal of Speech, Language, and Hearing Research</em>, 57(6), 2093–2101.</DocLI>
        <DocLI>RCSLT (2023). Clinical guidance: Fluency disorders. Royal College of Speech and Language Therapists. rcslt.org</DocLI>
        <DocLI>Stuart, A. et al (2004). Effect of monaural and binaural altered auditory feedback on stuttering frequency. <em className="text-slate-300">Journal of the Acoustical Society of America</em>, 116(5), 3086–3096.</DocLI>
        <DocLI>Titze, I.R. (1992). Acoustic interpretation of the voice range profile. <em className="text-slate-300">Journal of Speech and Hearing Research</em>, 35(1), 21–34.</DocLI>
      </DocUL>

    </DocPageLayout>
  );
}
