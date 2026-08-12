import type { Metadata } from 'next';
import DocPageLayout, {
  DocH2, DocH3, DocP, DocUL, DocLI, DocCallout, DocTable,
} from '@/components/DocPageLayout';

export const metadata: Metadata = {
  title: 'How to Use Access to Work for Flowen — Resources',
  description: 'Step-by-step guide to applying for an Access to Work grant to fund Flowen as assistive technology in your workplace.',
};

const TOC = [
  { id: 'what-is-atw',     label: 'What is Access to Work?' },
  { id: 'who-qualifies',   label: 'Who qualifies?' },
  { id: 'flowen-qualifies', label: 'How Flowen qualifies' },
  {
    id: 'how-to-apply', label: 'Step-by-step guide',
    sub: [
      { id: 'step-1-register', label: '1. Register your interest' },
      { id: 'step-2-assessment', label: '2. The assessment' },
      { id: 'step-3-claim', label: '3. Claiming support' },
    ],
  },
  { id: 'evidence-letter', label: 'Your evidence letter' },
  { id: 'employer',        label: 'Your employer\'s role' },
  { id: 'amounts',         label: 'How much you can receive' },
  { id: 'faq',             label: 'Common questions' },
  { id: 'contact-atw',     label: 'Contact Access to Work' },
];

export default function AccessToWorkPage() {
  return (
    <DocPageLayout
      tag="Funding"
      tagColor="emerald"
      title="How to Use Access to Work for Flowen"
      subtitle="Access to Work is a UK government grant that funds workplace support for people with disabilities and long-term health conditions. This guide explains how to apply for Flowen as assistive technology."
      date="August 2026"
      readTime="12 min"
      toc={TOC}
    >

      <DocH2 id="what-is-atw">What is Access to Work?</DocH2>
      <DocP>
        Access to Work (AtW) is a UK government grant scheme administered by the Department for Work and Pensions (DWP). It provides funding to help people with disabilities, long-term health conditions, and mental health conditions to start or stay in work. Unlike many disability benefits, Access to Work is not means-tested — it is based entirely on what support you need to do your job.
      </DocP>
      <DocP>
        The scheme can fund a wide range of support, including specialist equipment, software, travel, support workers, and communication support. Crucially, it covers the costs of assistive technology — tools that help compensate for barriers created by a disability.
      </DocP>
      <DocCallout variant="info">
        <DocP>Access to Work grants are separate from and do not affect any disability benefits you receive. You do not need to be receiving Personal Independence Payment (PIP), Employment and Support Allowance (ESA), or any other benefit to apply.</DocP>
      </DocCallout>

      <DocH2 id="who-qualifies">Who qualifies?</DocH2>
      <DocP>You may be eligible for Access to Work if you:</DocP>
      <DocUL>
        <DocLI>Have a disability, long-term health condition, or mental health condition (including a stammer or stutter)</DocLI>
        <DocLI>Are aged 16 or over</DocLI>
        <DocLI>Live in England, Scotland, or Wales (Northern Ireland has a separate scheme)</DocLI>
        <DocLI>Are employed, self-employed, or about to start a new job or work trial</DocLI>
        <DocLI>Work at least one hour per week</DocLI>
      </DocUL>
      <DocP>
        A stammer (also called a stutter or fluency disorder) is recognised as a disability under the Equality Act 2010 where it has a substantial and long-term adverse effect on normal day-to-day activities, including communication. Most people with a persistent stammer will meet this definition.
      </DocP>
      <DocCallout variant="tip">
        <DocP>You do not need a formal diagnosis to apply for Access to Work. If your stammer substantially affects your ability to communicate in your workplace — for example in meetings, calls, or presentations — that is sufficient evidence of need.</DocP>
      </DocCallout>

      <DocH2 id="flowen-qualifies">How Flowen qualifies as assistive technology</DocH2>
      <DocP>
        Flowen is a digital therapeutic platform that delivers real-time neural biofeedback and speech coordination training. It is designed to help people who stammer build more fluent speech patterns through evidence-based techniques including easy onset, diaphragmatic breathing support, and prolonged speech.
      </DocP>
      <DocP>
        Under Access to Work's assistive technology category, eligible software is defined as technology that helps compensate for a functional impairment related to a disability. Flowen qualifies on the following grounds:
      </DocP>
      <DocTable
        headers={['Criterion', 'How Flowen meets it']}
        rows={[
          ['Addresses a disability', 'Stammering is a recognised disability under the Equality Act 2010 affecting verbal communication'],
          ['Compensates for a workplace barrier', 'Flowen directly addresses verbal communication barriers in professional settings'],
          ['Digital/software tool', 'Flowen is a software platform accessed via web browser — no hardware required'],
          ['Evidence-based', 'Based on RCSLT-recognised fluency-shaping techniques with peer-reviewed biofeedback evidence'],
          ['Prescribed or recommended', 'Can be recommended by a speech and language therapist or occupational health provider'],
        ]}
      />
      <DocP>
        When speaking with your Access to Work assessor, describe Flowen as <strong className="text-slate-200">"specialist assistive software that uses real-time biofeedback to reduce stammering in workplace communication settings."</strong> This framing aligns directly with how AtW categorises software support.
      </DocP>

      <DocH2 id="how-to-apply">Step-by-step guide</DocH2>

      <DocH3 id="step-1-register">Step 1 — Register your interest</DocH3>
      <DocP>
        Applications are made online via the gov.uk Access to Work portal, or by calling 0800 121 7479. You will need your National Insurance number and your employer's name and address (or confirm you are self-employed).
      </DocP>
      <DocUL>
        <DocLI>Visit <strong className="text-slate-200">gov.uk/access-to-work</strong> and click "Apply now"</DocLI>
        <DocLI>Create a Government Gateway account if you don't already have one</DocLI>
        <DocLI>Complete the initial form describing your disability and how it affects your work</DocLI>
        <DocLI>State that you need support with verbal communication and would benefit from specialist assistive software</DocLI>
        <DocLI>You will be allocated a case manager and an appointment will be scheduled</DocLI>
      </DocUL>

      <DocH3 id="step-2-assessment">Step 2 — The assessment</DocH3>
      <DocP>
        An Access to Work assessment is usually conducted by phone or video. A case manager will ask you to describe how your stammer affects your work. This is not a medical examination — there is no pass or fail. The assessor's job is to understand what support would help you.
      </DocP>
      <DocP>Be prepared to describe:</DocP>
      <DocUL>
        <DocLI>How your stammer affects specific work tasks (meetings, phone calls, client presentations, Teams/Zoom calls)</DocLI>
        <DocLI>Any coping strategies you already use and their limitations</DocLI>
        <DocLI>Why you believe Flowen would help (daily practice, real-time technique feedback, preparation for high-pressure communication)</DocLI>
        <DocLI>Whether an SLT or GP has recommended speech therapy or assistive tools</DocLI>
      </DocUL>
      <DocCallout variant="info">
        <DocP>You can bring a supporter (such as an SLT, occupational health advisor, or friend) to your assessment. You can also ask for written questions in advance. If you would prefer a BSL interpreter or note-taker, the DWP will arrange this.</DocP>
      </DocCallout>

      <DocH3 id="step-3-claim">Step 3 — Claiming your support</DocH3>
      <DocP>
        If approved, you will receive a grant letter specifying what has been agreed and the maximum amount. Your employer may need to pay the cost of Flowen upfront and claim reimbursement — or, for self-employed applicants, you can claim costs directly.
      </DocP>
      <DocUL>
        <DocLI>Download the grant approval letter from your AtW online account</DocLI>
        <DocLI>Purchase or subscribe to Flowen using your personal or business payment method</DocLI>
        <DocLI>Submit a claim form with receipts via your AtW account (within 9 months of purchase)</DocLI>
        <DocLI>Reimbursement is typically processed within 20 working days</DocLI>
      </DocUL>

      <DocH2 id="evidence-letter">Your evidence letter</DocH2>
      <DocP>
        While not mandatory, providing a supporting letter from a GP, SLT, or occupational health provider significantly strengthens your application and reduces the likelihood of queries. If you have such a letter, it should include:
      </DocP>
      <DocUL>
        <DocLI>Confirmation that you have a diagnosed or assessed stammer/fluency disorder</DocLI>
        <DocLI>A statement that it substantially affects your verbal communication</DocLI>
        <DocLI>A recommendation that specialist assistive software would support your workplace communication</DocLI>
        <DocLI>The professional's name, registration number, and contact details</DocLI>
      </DocUL>
      <DocCallout variant="tip">
        <DocP>Contact us at <strong className="text-slate-200">hello@flowen.digital</strong> and we can provide you with a product information letter suitable for Access to Work applications, describing Flowen's clinical basis and evidence base in terms suitable for DWP assessors.</DocP>
      </DocCallout>

      <DocH2 id="employer">Your employer's role</DocH2>
      <DocP>
        If you are an employee, your employer may be required to contribute to the cost of support depending on the size of the business and the nature of the adjustment. Under Access to Work rules:
      </DocP>
      <DocTable
        headers={['Business size', 'Employee contribution', 'AtW contribution']}
        rows={[
          ['Fewer than 50 employees', '0%', 'Up to 100%'],
          ['50–249 employees', 'First £500', 'Remainder up to cap'],
          ['250+ employees', 'First £1,000', 'Remainder up to cap'],
        ]}
      />
      <DocP>
        For software subscriptions at Flowen's price points, most employees will find that AtW covers the full cost or the employer contribution is minimal. Your employer cannot prevent you from applying for Access to Work.
      </DocP>

      <DocH2 id="amounts">How much you can receive</DocH2>
      <DocP>
        Access to Work grants are not fixed amounts — they are based on assessed need. For assistive software, the grant will typically cover the cost of the subscription for an initial period (usually 12 months), with renewal reviews thereafter.
      </DocP>
      <DocP>
        There is an annual cap per person, but for software subscriptions at Flowen's pricing tier (£19.95–£79.99/month), the full annual subscription cost is comfortably within the scheme's limits for most applicants.
      </DocP>

      <DocH2 id="faq">Common questions</DocH2>

      <DocH3>Can I apply if I am self-employed?</DocH3>
      <DocP>Yes. Self-employed people can apply for Access to Work and claim the cost of assistive software directly without involving an employer.</DocP>

      <DocH3>My stammer is mild — can I still apply?</DocH3>
      <DocP>Yes, provided it substantially affects your ability to communicate at work. "Substantial" does not mean severe — even if you can manage most conversations, if your stammer creates significant anxiety, avoidance, or functional impairment in professional settings, you are likely eligible.</DocP>

      <DocH3>Will Access to Work affect my benefits?</DocH3>
      <DocP>No. Access to Work grants are not means-tested and do not count as income. They do not affect PIP, Universal Credit, ESA, or any other benefit.</DocP>

      <DocH3>How long does the process take?</DocH3>
      <DocP>Initial decisions are typically made within 4–6 weeks of your assessment. Urgent cases (where you are about to start a new job) can be prioritised — ask your case manager about expedited review.</DocP>

      <DocH3>Can I apply for more than one type of support?</DocH3>
      <DocP>Yes. A single Access to Work application can include multiple types of support — for example, assistive software (Flowen) plus coaching support or communication training.</DocP>

      <DocH2 id="contact-atw">Contact Access to Work</DocH2>
      <DocTable
        headers={['Channel', 'Details']}
        rows={[
          ['Online',        'gov.uk/access-to-work'],
          ['Phone',         '0800 121 7479 (free from mobiles and landlines)'],
          ['Textphone',     '0800 121 7579'],
          ['BSL video',     'via the Access to Work online portal'],
          ['Opening hours', 'Monday–Friday, 9am–5pm'],
        ]}
      />
      <DocCallout variant="info">
        <DocP>If you would like a Flowen product information letter or supporting documentation for your AtW application, email us at <strong className="text-slate-200">hello@flowen.digital</strong>. We typically respond within one business day.</DocP>
      </DocCallout>

    </DocPageLayout>
  );
}
