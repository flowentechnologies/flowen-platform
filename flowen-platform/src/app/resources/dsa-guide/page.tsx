import type { Metadata } from 'next';
import DocPageLayout, {
  DocH2, DocH3, DocP, DocUL, DocLI, DocCallout, DocTable,
} from '@/components/DocPageLayout';

export const metadata: Metadata = {
  title: 'DSA Guide: Funding Flowen as a University Student — Flowen Resources',
  description: 'How to use the Disabled Students Allowance (DSA) to fund Flowen as an assistive technology at university. Who qualifies, how to apply, and what you can receive.',
};

const TOC = [
  { id: 'what-is-dsa',     label: 'What is DSA?' },
  { id: 'who-qualifies',   label: 'Who qualifies?' },
  { id: 'how-flowen-qualifies', label: 'How Flowen qualifies' },
  {
    id: 'applying',        label: 'Applying for DSA',
    sub: [
      { id: 'step-1-apply',    label: '1. Submit your DSA application' },
      { id: 'step-2-assess',   label: '2. Needs assessment' },
      { id: 'step-3-receive',  label: '3. Receiving your support' },
    ],
  },
  { id: 'evidence',        label: 'Evidence of your stammer' },
  { id: 'amounts',         label: 'What you can receive' },
  { id: 'existing-users',  label: 'Already receiving DSA?' },
  { id: 'faq',             label: 'Frequently asked questions' },
  { id: 'useful-contacts', label: 'Useful contacts' },
];

export default function DsaGuidePage() {
  return (
    <DocPageLayout
      tag="Disability"
      tagColor="amber"
      title="DSA Guide: Funding Flowen at University"
      subtitle="The Disabled Students' Allowance (DSA) is a UK government fund for students with disabilities and health conditions. This guide explains how to use DSA to fund Flowen as specialist assistive technology at university or college."
      date="August 2026"
      readTime="14 min"
      toc={TOC}
    >

      <DocH2 id="what-is-dsa">What is the Disabled Students' Allowance?</DocH2>
      <DocP>
        The Disabled Students' Allowance (DSA) is a UK government grant administered by Student Finance England (SFE), Student Finance Wales, Student Awards Agency Scotland (SAAS), or the Student Loans Company Northern Ireland, depending on where you live. It provides funding for disability-related support costs that arise because of your studies — it is not a loan and does not have to be repaid.
      </DocP>
      <DocP>
        DSA is available to eligible students in undergraduate, postgraduate taught, and postgraduate research programmes at UK higher education providers. It covers costs above what the university itself is required to provide through its duty to make reasonable adjustments under the Equality Act 2010.
      </DocP>
      <DocCallout variant="info">
        <DocP>DSA is not means-tested — it is based entirely on your assessed support needs. Your household income, the income of your partner or parents, and any other benefits you receive do not affect your eligibility for DSA.</DocP>
      </DocCallout>

      <DocH2 id="who-qualifies">Who qualifies?</DocH2>
      <DocP>You may be eligible for DSA if you:</DocP>
      <DocUL>
        <DocLI>Have a disability, long-term health condition, specific learning difficulty, or mental health condition — including a stammer or fluency disorder</DocLI>
        <DocLI>Are a UK student studying at a UK higher education institution (university, college, or conservatoire)</DocLI>
        <DocLI>Are registered with a UK funding body for student finance (Student Finance England, Wales, Scotland, or Northern Ireland)</DocLI>
        <DocLI>Are studying on a qualifying course (undergraduate or postgraduate level)</DocLI>
      </DocUL>
      <DocP>
        A stammer (also called stuttering or fluency disorder) is a recognised disability under the Equality Act 2010 where it has a substantial and long-term adverse effect on day-to-day activities. For most students with a persistent stammer, this condition is met — particularly where the stammer creates a significant barrier to oral assessments, seminar participation, group projects, or presentations.
      </DocP>
      <DocCallout variant="tip">
        <DocP>Part-time students are also eligible for DSA, provided they are receiving student finance. If you are unsure whether your course qualifies, contact your university's Disability Advisory Service — they can advise without you needing to commit to a formal DSA application.</DocP>
      </DocCallout>

      <DocH2 id="how-flowen-qualifies">How Flowen qualifies as specialist technology</DocH2>
      <DocP>
        DSA covers the cost of specialist equipment, software, and assistive technology that is specifically needed as a result of your disability. Under current DSA guidance from the Office for Students (OfS) and Student Finance England, specialist software for students with communication disorders qualifies where it is recommended following a needs assessment.
      </DocP>
      <DocTable
        headers={['DSA criterion', 'How Flowen meets it']}
        rows={[
          ['Specialist technology',         'Flowen is specialist assistive software — not general productivity software available to all students'],
          ['Disability-related need',       'Stammering creates specific barriers to oral participation, seminar contributions, and oral exams — Flowen directly addresses these'],
          ['Not available to all students', 'Flowen is prescribed to address a specific communication disability, not a general study tool'],
          ['Evidence-based',               'Based on RCSLT-recognised fluency-shaping techniques; peer-reviewed evidence base for biofeedback intervention'],
          ['Recommended by assessor',       'DSA Needs Assessors can recommend Flowen as specialist software under the software support category'],
        ]}
      />
      <DocP>
        At your needs assessment (see below), describe Flowen as <strong className="text-slate-200">"specialist assistive software using real-time biofeedback to reduce stammering in academic oral communication settings"</strong> and explain how it specifically supports your participation in seminars, group work, oral examinations, and presentations.
      </DocP>

      <DocH2 id="applying">Applying for DSA</DocH2>

      <DocH3 id="step-1-apply">Step 1 — Submit your DSA application</DocH3>
      <DocP>
        Apply for DSA through your Student Finance account at the same time as (or after) applying for student finance. You do not need to wait until you have enrolled at university.
      </DocP>
      <DocUL>
        <DocLI>Log into your Student Finance online account at <strong className="text-slate-200">studentfinance.gov.uk</strong> (England)</DocLI>
        <DocLI>Find the DSA section and complete the application form</DocLI>
        <DocLI>Select the disability type that best describes your condition — for a stammer, this is typically "other disability, long-term health condition, or physical impairment"</DocLI>
        <DocLI>Provide a brief description of how your stammer affects your studies</DocLI>
        <DocLI>You will be asked to provide medical evidence — see the Evidence section below</DocLI>
        <DocLI>Once your application is received, Student Finance will write to you with next steps</DocLI>
      </DocUL>
      <DocCallout variant="info">
        <DocP>Scottish students apply through SAAS (saas.gov.uk). Welsh students apply through Student Finance Wales (studentfinancewales.co.uk). Students from Northern Ireland apply through Student Finance NI (studentfinanceni.co.uk).</DocP>
      </DocCallout>

      <DocH3 id="step-2-assess">Step 2 — The needs assessment</DocH3>
      <DocP>
        Once your eligibility is confirmed, you will be referred to a DSA Needs Assessment. This is an appointment with a specialist assessor (usually lasting 1.5–2 hours) who will identify the specific support you need in the context of your studies. The needs assessor is independent of Student Finance and their role is to advocate for your needs — not to gatekeep support.
      </DocP>
      <DocP>
        At the assessment, be prepared to discuss:</DocP>
      <DocUL>
        <DocLI>How your stammer affects specific academic activities — seminars, group work, oral exams, presentations, speaking to tutors</DocLI>
        <DocLI>Whether you avoid certain academic activities because of your stammer (avoidance is important evidence of impact)</DocLI>
        <DocLI>Any previous or current speech therapy and its outcomes</DocLI>
        <DocLI>What tools or strategies you currently use and their limitations</DocLI>
        <DocLI>Why real-time biofeedback practice (Flowen) would help you prepare for high-stakes oral communication in your studies</DocLI>
      </DocUL>
      <DocP>
        Following the assessment, the assessor will produce a Needs Assessment Report (NAR) recommending specific support, equipment, and software. This report is sent to Student Finance, who will then issue a DSA entitlement letter.
      </DocP>
      <DocCallout variant="tip">
        <DocP>You can request Flowen by name at your needs assessment. Bring a copy of this guide and any SLT letters you have. If the assessor is unfamiliar with Flowen, contact us at <strong className="text-slate-200">hello@flowen.digital</strong> and we can provide a product information sheet specifically for DSA Needs Assessors.</DocP>
      </DocCallout>

      <DocH3 id="step-3-receive">Step 3 — Receiving your support</DocH3>
      <DocP>
        Once Student Finance issues your DSA entitlement letter, you will be able to claim for the recommended support. For specialist software like Flowen:
      </DocP>
      <DocUL>
        <DocLI>Student Finance will either pay the supplier directly, or reimburse you after purchase — your entitlement letter will specify which applies</DocLI>
        <DocLI>For reimbursement claims, purchase Flowen and retain your receipts/invoices</DocLI>
        <DocLI>Submit a claim via your Student Finance account with the receipts attached</DocLI>
        <DocLI>Your university's Disability Advisory Service can help you navigate the claim process</DocLI>
      </DocUL>

      <DocH2 id="evidence">Evidence of your stammer</DocH2>
      <DocP>
        Student Finance requires medical evidence as part of your DSA application. For a stammer, acceptable evidence includes:
      </DocP>
      <DocUL>
        <DocLI>A letter from a Speech and Language Therapist (SLT) confirming your diagnosis and the impact on daily communication</DocLI>
        <DocLI>A GP letter confirming your stammer and that it has a substantial and long-term effect on daily activities</DocLI>
        <DocLI>An audiology or ENT report (if your stammer has been assessed in a medical context)</DocLI>
        <DocLI>A previous school or university assessment confirming a communication difficulty</DocLI>
      </DocUL>
      <DocP>
        If you have never had formal SLT input, a GP letter is usually sufficient for DSA eligibility. The GP letter does not need to be detailed — a brief statement confirming your stammer and its impact on daily verbal communication is enough.
      </DocP>
      <DocCallout variant="info">
        <DocP>If you are struggling to obtain medical evidence, contact your university's Disability Advisory Service — they often have experience navigating this for students with communication disorders and may be able to support you through the evidence-gathering process.</DocP>
      </DocCallout>

      <DocH2 id="amounts">What you can receive</DocH2>
      <DocP>
        DSA support for specialist technology is provided in addition to other DSA allowances (non-medical helpers, general disability equipment). For the academic year 2025–26, DSA has the following allowances:
      </DocP>
      <DocTable
        headers={['DSA category', '2025–26 allowance']}
        rows={[
          ['Specialist equipment (one-off)',     'Up to £26,666 over the whole course'],
          ['Non-medical helpers (per year)',      'Up to £27,310 per year'],
          ['General disability-related costs',   'Up to £1,959 per year'],
          ['Travel allowance',                   'No fixed limit — based on assessed need'],
        ]}
      />
      <DocP>
        Flowen's subscription cost falls within the general disability-related costs allowance in most cases, though it can also be recommended as specialist software under the equipment allowance. Your needs assessor will determine the most appropriate category based on your individual circumstances.
      </DocP>

      <DocH2 id="existing-users">Already receiving DSA?</DocH2>
      <DocP>
        If you are already receiving DSA but Flowen was not included in your original Needs Assessment Report, you can request a review of your DSA support. Contact Student Finance to request a reassessment — you do not need to wait until the end of the academic year.
      </DocP>
      <DocUL>
        <DocLI>You can request a reassessment if your needs have changed or if new specialist technology has become available</DocLI>
        <DocLI>Contact your university's Disability Advisory Service to initiate a reassessment request</DocLI>
        <DocLI>Provide a brief explanation of why you believe Flowen would address a need not currently met by your existing support</DocLI>
      </DocUL>

      <DocH2 id="faq">Frequently asked questions</DocH2>

      <DocH3>Will applying for DSA affect my student loan or grant?</DocH3>
      <DocP>No. DSA is completely separate from your tuition fee loan and maintenance loan. It does not reduce any other student finance entitlement and does not need to be repaid.</DocP>

      <DocH3>Do I need to have had SLT in the past to apply?</DocH3>
      <DocP>No. You do not need a history of speech therapy. A GP letter confirming your stammer and its impact on communication is sufficient for most DSA applications. The needs assessor will evaluate your current needs regardless of your previous treatment history.</DocP>

      <DocH3>Can postgraduate students get DSA?</DocH3>
      <DocP>Yes. Postgraduate taught (Masters) and postgraduate research (PhD) students are eligible for DSA provided they meet the residency and funding requirements. The process is the same as for undergraduate students.</DocP>

      <DocH3>What if my needs assessor isn't familiar with Flowen?</DocH3>
      <DocP>Ask the assessor to consider Flowen as specialist communication software for a fluency disorder. We provide a product information sheet designed for needs assessors — email us at <strong className="text-slate-200">hello@flowen.digital</strong> and we'll send it to you within one working day.</DocP>

      <DocH3>Can I get DSA if I am an international student?</DocH3>
      <DocP>DSA is available to UK home students only. International (overseas fee-paying) students are not eligible. However, your university may have its own disability support fund or bursary — contact your Disability Advisory Service to enquire.</DocP>

      <DocH3>How long does the DSA process take?</DocH3>
      <DocP>The full process from application to receiving your entitlement letter typically takes 6–10 weeks, though this can be faster if you apply early in the cycle. It is advisable to apply as early as possible — ideally before or during the first term of your course.</DocP>

      <DocH2 id="useful-contacts">Useful contacts</DocH2>
      <DocTable
        headers={['Organisation', 'Contact']}
        rows={[
          ['Student Finance England',       'studentfinance.gov.uk · 0300 100 0607'],
          ['Student Finance Wales',         'studentfinancewales.co.uk · 0300 200 4050'],
          ['Student Awards Agency Scotland','saas.gov.uk · 0300 555 0505'],
          ['Student Finance NI',            'studentfinanceni.co.uk · 0300 100 0077'],
          ['Disability Advisory Service',   'At your university — search "[university name] disability support"'],
          ['British Stammering Association','stamma.org · helpline: 0808 802 0002'],
          ['Flowen support',               'hello@flowen.digital'],
        ]}
      />
      <DocCallout variant="tip">
        <DocP>Your university's Disability Advisory Service is often the best first port of call — they have DSA expertise, can help you gather evidence, accompany you to your needs assessment, and liaise with Student Finance on your behalf. Most universities offer this support free of charge to any student with a disclosed disability.</DocP>
      </DocCallout>

    </DocPageLayout>
  );
}
