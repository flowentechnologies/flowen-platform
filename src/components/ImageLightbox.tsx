'use client';

import { useEffect, useState, useCallback } from 'react';

interface LightboxState {
  src: string;
  alt: string;
}

/**
 * Makes every meaningful <img> in the app clickable to view at its actual,
 * native pixel size in a popup — regardless of how small the page's
 * responsive CSS has scaled it down to. Implemented once, globally, as a
 * single document-level click listener rather than wrapping every
 * individual <img>/next/image usage across the app (marketing pages,
 * dashboard, admin, blog, ...) — both render a plain <img> in the DOM, so
 * one listener catches either, and any image added anywhere in the future
 * gets this for free with no further work.
 *
 * Deliberately skipped, so this stays a genuine feature rather than a
 * nuisance:
 *   - Images inside a link or button (`closest('a, button, [role="button"]')`)
 *     — clicking those already does something real (navigate, submit);
 *     this must not hijack that click.
 *   - Small images (natural size under 48px either dimension) — icons,
 *     logo marks, small avatars. There's nothing meaningful to "view at
 *     actual size" for a 24px icon, and popping a full-screen modal for
 *     one would be irritating, not useful.
 *   - Anything explicitly opted out via a data-no-lightbox attribute.
 *   - Anywhere a component's own onClick already calls stopPropagation —
 *     native bubbling means this listener (attached on `document`, so it
 *     fires last) never sees that click at all, which is exactly the
 *     right behaviour: an image with its own deliberate click handler
 *     keeps it, undisturbed.
 */
export function ImageLightbox() {
  const [active, setActive] = useState<LightboxState | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (target.closest('a, button, [role="button"], [data-no-lightbox]')) return;
      if (target.naturalWidth < 48 || target.naturalHeight < 48) return;

      setActive({ src: target.currentSrc || target.src, alt: target.alt || '' });
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const close = useCallback(() => setActive(null), []);

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    // Prevent the page behind the modal from scrolling while it's open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [active, close]);

  if (!active) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={active.alt || 'Image preview'}
      onClick={close}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm overflow-auto p-6 cursor-zoom-out"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="fixed top-4 right-4 z-10 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white flex items-center justify-center text-2xl leading-none transition-colors cursor-pointer"
      >
        ×
      </button>
      {/* Deliberately a plain <img>, not next/image — the whole point is
          the real, native-resolution file at 1:1 pixel scale, not an
          optimizer-resized copy. No max-width/max-height constraint: a
          large image scrolls within the overlay (overflow-auto above)
          rather than being shrunk to fit, which is the point of an
          "actual size" view; a small image just renders small. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={active.src}
        alt={active.alt}
        onClick={e => e.stopPropagation()}
        className="cursor-default shadow-2xl"
        style={{ maxWidth: 'none', maxHeight: 'none' }}
      />
      {active.alt && (
        <p
          onClick={e => e.stopPropagation()}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-slate-900/80 text-white text-xs max-w-[90vw] truncate cursor-default"
        >
          {active.alt}
        </p>
      )}
    </div>
  );
}
