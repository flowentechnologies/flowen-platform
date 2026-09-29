'use client';

export default function ManageCookieConsent() {
  return (
    <button type="button" className="text-emerald-400 underline text-sm"
      onClick={() => window.dispatchEvent(new Event('flowen:consent:manage'))}>
      Change cookie choices
    </button>
  );
}
