import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import type { Metadata } from 'next';

// ── Conformance table helpers ─────────────────────────────────────────────────

type SCStatus = 'Compliant' | 'Partial' | 'In Progress';

interface SCRow {
  sc:     string;
  title:  string;
  status: SCStatus;
  note:   string;
}

function StatusBadge({ status }: { status: SCStatus }) {
  const styles: Record<SCStatus, string> = {
    Compliant:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Partial:      'bg-yellow-500/10  text-yellow-400  border-yellow-500/20',
    'In Progress':'bg-slate-800      text-slate-400   border-slate-700',
  };
  return (
    <span className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {status}
    </span>
  );
}

interface ConformanceGroupProps {
  principle:   string;
  label:       string;
  description: string;
  rows:        SCRow[];
}

function ConformanceGroup({ principle, label, description, rows }: ConformanceGroupProps) {
  const compliant = rows.filter(r => r.status === 'Compliant').length;
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            Principle {principle}
          </span>
          <h3 className="text-base font-bold text-white">{label}</h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {compliant}/{rows.length} compliant
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-4">{description}</p>
      <div className="space-y-2">
        {rows.map(row => (
          <div key={row.sc} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-[10px] font-mono text-slate-400 shrink-0">{row.sc}</span>
                <span className="text-sm font-semibold text-white truncate">{row.title}</span>
              </div>
              <StatusBadge status={row.status} />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{row.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const metadata: Metadata = {
  title: 'Accessibility Statement — Flowen Speech Platform',
  description: 'Flowen\'s commitment to WCAG 2.1 AA accessibility for people with disabilities, including those who stutter.',
};

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <MarketingNavbar />

      <main id="main-content" className="flex-1 max-w-3xl mx-auto px-6 py-16">
        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          ACCESSIBILITY
        </span>
        <h1 className="text-4xl font-extrabold text-white tracking-tight mt-4">Accessibility Statement</h1>
        <p className="text-slate-400 text-xs mt-2">Last updated: 8 August 2026</p>

        <div className="mt-10 space-y-10 text-sm text-slate-300 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-white mb-4">Our Commitment</h2>
            <p className="text-slate-400">
              Flowen is built for people who stutter. Many of our users have additional disabilities — anxiety, motor impairments, and neurodivergent conditions are disproportionately prevalent in the stuttering community. We take accessibility seriously, not as a compliance checkbox, but as a core design requirement.
            </p>
            <p className="text-slate-400 mt-3">
              We are working toward conformance with the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA. This is our current status and the areas where we are still improving.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-4">Conformance Status</h2>
            <p className="text-slate-400 mb-3">
              Flowen is <strong className="text-white">partially conformant</strong> with WCAG 2.1 Level AA.
              The table below covers all key success criteria across the four WCAG principles.
              Criteria marked <span className="text-yellow-400 font-semibold">Partial</span> or <span className="text-slate-400 font-semibold">In Progress</span> are documented in Known Limitations below.
            </p>

            {/* Summary bar */}
            {(() => {
              const all = [
                // Perceivable — 1.3.1 still Partial (chart a11y), 1.4.13 still In Progress
                'C','C','C','C','P','C','C','C','C','C','C','C','C','C','C','C','I',
                // Operable — 2.1.1 now Compliant (all buttons have accessible names);
                //            2.2.1 still Partial (pitch-deck time-limit exception)
                'C','C','C','P','C','C','C','C','C','C','C','C','C','C','C',
                // Understandable — all Compliant
                'C','C','C','C','C','C','C','C','C','C',
                // Robust — 4.1.2 and 4.1.3 now Compliant (ARIA roles, live regions)
                'C','C','C',
              ] as const;
              const compliant    = all.filter(s => s === 'C').length;
              const partial      = all.filter(s => s === 'P').length;
              const inProgress   = all.filter(s => s === 'I').length;
              const total        = all.length;
              const pct          = Math.round((compliant / total) * 100);
              return (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 font-mono">
                      <span className="text-emerald-400 font-bold">{compliant}</span> Compliant ·{' '}
                      <span className="text-yellow-400 font-bold">{partial}</span> Partial ·{' '}
                      <span className="text-slate-400 font-bold">{inProgress}</span> In Progress ·{' '}
                      <span className="text-slate-400">{total} criteria total</span>
                    </p>
                  </div>
                  <div className="text-3xl font-black text-white shrink-0">{pct}%</div>
                </div>
              );
            })()}

            {/* ── Principle 1: Perceivable ─────────────────────────────── */}
            <ConformanceGroup
              principle="1"
              label="Perceivable"
              description="Information and UI components must be presentable to users in ways they can perceive."
              rows={[
                { sc: '1.1.1', title: 'Non-text Content', status: 'Compliant',     note: 'All images include meaningful alt text. Decorative images use empty alt="". The 3D avatar canvas exposes a text description via aria-label.' },
                { sc: '1.2.2', title: 'Captions (Prerecorded)', status: 'Compliant',  note: 'No prerecorded video content is published without captions. Tutorial videos include English closed captions.' },
                { sc: '1.2.4', title: 'Captions (Live)',         status: 'Compliant',  note: 'No live broadcast or streaming events are hosted on the platform. The practice engine captures a live caption transcript via the Web Speech API during each session; the full text is saved with the session record so users can retrieve it after practice.' },
                { sc: '1.2.5', title: 'Audio Description',       status: 'Compliant',  note: 'Tutorial videos do not rely on visual-only information to convey meaning. Narration tracks cover all visual content.' },
                { sc: '1.3.1', title: 'Info and Relationships',  status: 'Partial',    note: 'Semantic HTML5 elements (nav, main, section, aside) are used throughout. Chart data in the clinician analytics view is being supplemented with accessible data table equivalents.' },
                { sc: '1.3.2', title: 'Meaningful Sequence',     status: 'Compliant',  note: 'Reading order follows the visual order. No CSS that visually reorders content independently of the DOM order.' },
                { sc: '1.3.3', title: 'Sensory Characteristics', status: 'Compliant',  note: 'Instructions do not rely solely on shape, size, location, or sound. Buttons are identified by label, not position.' },
                { sc: '1.3.4', title: 'Orientation',             status: 'Compliant',  note: 'Content is not locked to a single screen orientation. Practice sessions work in both portrait and landscape.' },
                { sc: '1.3.5', title: 'Identify Input Purpose',  status: 'Compliant',  note: 'All authentication and billing form fields carry the correct autocomplete attribute (email, current-password, given-name, cc-number, etc.).' },
                { sc: '1.4.1', title: 'Use of Color',            status: 'Compliant',  note: 'Color is never the sole means of conveying information. Status badges use both color and a text label. Error states include icons and text.' },
                { sc: '1.4.2', title: 'Audio Control',           status: 'Compliant',  note: 'No audio plays automatically for more than three seconds. The biofeedback pacer plays optional audio cues only when the user starts a session.' },
                { sc: '1.4.3', title: 'Contrast (Minimum)',      status: 'Compliant',  note: 'All body text meets the 4.5:1 minimum ratio. Large text (≥18pt or 14pt bold) meets 3:1. Verified with Colour Contrast Analyser against all theme variants.' },
                { sc: '1.4.4', title: 'Resize Text',             status: 'Compliant',  note: 'Interface scales correctly at 200% browser zoom on desktop. Text reflows without loss of content or functionality.' },
                { sc: '1.4.5', title: 'Images of Text',          status: 'Compliant',  note: 'All visible text is rendered as real text. No images containing text are used for layout or labels.' },
                { sc: '1.4.10', title: 'Reflow',                 status: 'Compliant',  note: 'At 320 CSS px viewport width there is no horizontal scrolling. Tables and data grids have overflow-x: auto wrappers.' },
                { sc: '1.4.11', title: 'Non-text Contrast',      status: 'Compliant',  note: 'Focus indicators, input borders, checkboxes, and graphical components all meet the 3:1 ratio against adjacent colors.' },
                { sc: '1.4.13', title: 'Content on Hover/Focus', status: 'In Progress', note: 'Tooltip components appear on hover and are dismissable with Escape. Popovers that appear on focus are being reviewed to ensure they remain visible when the mouse is moved over them.' },
              ]}
            />

            {/* ── Principle 2: Operable ────────────────────────────────── */}
            <ConformanceGroup
              principle="2"
              label="Operable"
              description="UI components and navigation must be operable."
              rows={[
                { sc: '2.1.1', title: 'Keyboard',                status: 'Compliant', note: 'All interactive elements are standard HTML button, a, input, and select elements and are fully keyboard operable. Stage selector buttons carry aria-label and aria-pressed so their state is conveyed without relying on visual position. Settings toggle buttons and the voice-coach mute button all have accessible names. No functionality requires mouse-only interaction.' },
                { sc: '2.1.2', title: 'No Keyboard Trap',        status: 'Compliant', note: 'Focus is managed inside modal dialogs and dismissed with Escape. No mechanism exists that prevents the keyboard focus from moving away.' },
                { sc: '2.1.4', title: 'Character Key Shortcuts',  status: 'Compliant', note: 'The application does not implement single-character keyboard shortcuts that could be accidentally triggered.' },
                { sc: '2.2.1', title: 'Timing Adjustable',       status: 'Partial',   note: 'Session timers can be paused and extended. The investor pitch deck link has a time-limited expiry set by the sender; users who need an extension should contact Flowen directly.' },
                { sc: '2.2.2', title: 'Pause, Stop, Hide',       status: 'Compliant', note: 'The biofeedback pacer animation can be paused via the session controls. Auto-updating content (live session stats) stops when the session is paused.' },
                { sc: '2.3.1', title: 'Three Flashes',           status: 'Compliant', note: 'No content flashes more than three times per second. The biofeedback orb pulses at ≤2 Hz and respects prefers-reduced-motion.' },
                { sc: '2.4.1', title: 'Bypass Blocks',           status: 'Compliant', note: 'A "Skip to main content" link is the first focusable element on every page. It becomes visible on focus and moves keyboard focus directly to the main landmark.' },
                { sc: '2.4.2', title: 'Page Titled',             status: 'Compliant', note: 'Every page has a unique, descriptive <title> element that identifies both the page and the site (e.g., "Practice Engine — Flowen").' },
                { sc: '2.4.3', title: 'Focus Order',             status: 'Compliant', note: 'Keyboard focus follows the logical DOM order. Modals receive focus on open and restore focus to the trigger element on close.' },
                { sc: '2.4.4', title: 'Link Purpose',            status: 'Compliant', note: 'Link text is descriptive in context. Icons-only links include aria-label. "Read more" patterns are avoided; where necessary, aria-describedby is used.' },
                { sc: '2.4.5', title: 'Multiple Ways',           status: 'Compliant', note: 'Pages can be reached via the navigation menu, the sitemap, and the search function (dashboard). Marketing pages are linked from the footer.' },
                { sc: '2.4.6', title: 'Headings and Labels',     status: 'Compliant', note: 'A single h1 per page. Heading hierarchy (h1 → h2 → h3) is semantically correct throughout. Form fields have visible, programmatically associated labels.' },
                { sc: '2.4.7', title: 'Focus Visible',           status: 'Compliant', note: 'All interactive elements show a visible focus ring (2px offset ring using the brand teal). Custom components override browser defaults rather than suppressing them.' },
                { sc: '2.5.1', title: 'Pointer Gestures',        status: 'Compliant', note: 'No functionality requires multi-point gestures (pinch, swipe) without a single-pointer alternative.' },
                { sc: '2.5.3', title: 'Label in Name',           status: 'Compliant', note: 'The visible text label of every button and link is included in its accessible name. No aria-label overrides that conflict with visible text.' },
              ]}
            />

            {/* ── Principle 3: Understandable ──────────────────────────── */}
            <ConformanceGroup
              principle="3"
              label="Understandable"
              description="Information and the operation of the UI must be understandable."
              rows={[
                { sc: '3.1.1', title: 'Language of Page',        status: 'Compliant', note: 'lang="en-GB" is set on the root <html> element of every page.' },
                { sc: '3.1.2', title: 'Language of Parts',       status: 'Compliant', note: 'All user-facing content is in English. No language switching is used within pages. Clinical terminology is expanded on first use with plain-language descriptions.' },
                { sc: '3.2.1', title: 'On Focus',                status: 'Compliant', note: 'Receiving focus does not trigger any unexpected context change. No auto-navigation or form submission occurs on focus.' },
                { sc: '3.2.2', title: 'On Input',                status: 'Compliant', note: 'Changing the value of a form control does not automatically submit the form or cause a context change without prior notice.' },
                { sc: '3.2.3', title: 'Consistent Navigation',   status: 'Compliant', note: 'Navigation components appear in the same location and same order across pages. Breadcrumbs follow a consistent pattern in the dashboard.' },
                { sc: '3.2.4', title: 'Consistent Identification', status: 'Compliant', note: 'Components with the same function are identified consistently. The save button is always labelled "Save" (never alternating with "Update").' },
                { sc: '3.3.1', title: 'Error Identification',    status: 'Compliant', note: 'Form validation errors are identified in text and associated with the relevant field via aria-describedby. Errors are not indicated by color alone.' },
                { sc: '3.3.2', title: 'Labels or Instructions',  status: 'Compliant', note: 'All form inputs have visible labels. Required fields are indicated. Complex inputs include helper text with format instructions (e.g., date fields).' },
                { sc: '3.3.3', title: 'Error Suggestion',        status: 'Compliant', note: 'Error messages suggest the correct format or input. Password complexity failures list each unmet requirement individually.' },
                { sc: '3.3.4', title: 'Error Prevention',        status: 'Compliant', note: 'Subscription purchases and account deletion require a confirmation step. Submitted forms that result in legal or financial commitments can be reviewed before final submission.' },
              ]}
            />

            {/* ── Principle 4: Robust ──────────────────────────────────── */}
            <ConformanceGroup
              principle="4"
              label="Robust"
              description="Content must be robust enough to be interpreted by a wide variety of user agents, including assistive technologies."
              rows={[
                { sc: '4.1.1', title: 'Parsing',            status: 'Compliant',    note: 'React/Next.js generates well-formed HTML. Automated Lighthouse and axe scans confirm no duplicate IDs, unclosed tags, or invalid nesting in any page.' },
                { sc: '4.1.2', title: 'Name, Role, Value',  status: 'Compliant',    note: 'Standard HTML elements and ARIA roles are applied throughout. The 3D biofeedback avatar is wrapped in role="img" with a descriptive aria-label and a speaking-state aria-live region. Custom toggle switches carry aria-pressed and aria-label. Stage selector buttons expose their selected state via aria-pressed. The voice-coach mute control carries aria-label and aria-pressed.' },
                { sc: '4.1.3', title: 'Status Messages',    status: 'Compliant',    note: 'Toast notifications use role="status" and aria-live="polite". The recording indicator carries role="status". Block detections are announced via aria-live="polite" on the blocks counter. The voice-coach feedback text and breathing pacer phase text both use aria-live="polite". The live captions area uses role="log" (which implies polite live updates). Decorative waveform bars are excluded from the accessibility tree with aria-hidden="true".' },
              ]}
            />
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-4">Known Limitations</h2>
            <ul className="space-y-3 text-slate-400">
              <li className="flex items-start gap-3">
                <span className="text-slate-400 flex-shrink-0 font-bold mt-0.5">—</span>
                The audio capture feature requires a microphone. Users without microphone access receive a static reference guide mode instead of a live session.
              </li>
              <li className="flex items-start gap-3">
                <span className="text-slate-400 flex-shrink-0 font-bold mt-0.5">—</span>
                Data visualisation charts in the clinician analytics dashboard are currently accompanied by summary statistics but lack full ARIA table equivalents. We are adding accessible data tables alongside each chart (SC 1.3.1).
              </li>
              <li className="flex items-start gap-3">
                <span className="text-slate-400 flex-shrink-0 font-bold mt-0.5">—</span>
                The investor pitch deck link includes a sender-defined time-limited expiry. Users who need an extension should contact <a href="mailto:hello@flowen.digital" className="text-emerald-400 underline">hello@flowen.digital</a> (SC 2.2.1).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-4">Assistive Technologies Tested</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                'NVDA + Chrome (Windows)',
                'JAWS + Chrome (Windows)',
                'VoiceOver + Safari (macOS)',
                'VoiceOver + Safari (iOS)',
                'TalkBack + Chrome (Android)',
                'Dragon NaturallySpeaking',
              ].map(at => (
                <div key={at} className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-xs text-slate-300">
                  {at}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-4">Feedback & Contact</h2>
            <p className="text-slate-400 mb-4">
              If you experience any accessibility barrier when using Flowen, or if you need content in an alternative format, please contact us:
            </p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <dl className="space-y-3 text-sm">
                <div><dt className="text-slate-400 text-xs">Email</dt><dd className="text-emerald-400 mt-0.5"><a href="mailto:hello@flowen.digital?subject=[ACCESSIBILITY]">hello@flowen.digital</a></dd></div>
                <div><dt className="text-slate-400 text-xs">Subject line</dt><dd className="text-slate-300 font-mono mt-0.5">[ACCESSIBILITY]</dd></div>
                <div><dt className="text-slate-400 text-xs">Response time</dt><dd className="text-slate-300 mt-0.5">Within 5 working days</dd></div>
              </dl>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-4">Legal Basis</h2>
            <p className="text-slate-400">
              This statement is provided in accordance with the Public Sector Bodies (Websites and Mobile Applications) (No.2) Accessibility Regulations 2018 and the Equality Act 2010. The platform was internally audited in July 2026. An independent WCAG 2.1 AA audit is scheduled for Q4 2026.
            </p>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
