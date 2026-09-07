'use client';

import { useEffect, useState, useCallback } from 'react';

interface LightboxState {
  src: string;
  alt: string;
}

/**
 * Makes every meaningful <img> in the app clickable to view larger in a
 * popup — regardless of how small the page's responsive CSS has scaled it
 * down to. Implemented once, globally, as a single document-level click
 * listener rather than wrapping every individual <img>/next/image usage
 * across the app (marketing pages, dashboard, admin, blog, ...) — both
 * render a plain <img> in the DOM, so one listener catches either, and any
 * image added anywhere in the future gets this for free with no further
 * work.
 *
 * The popup itself auto-adjusts to whatever screen it's opened on: it
 * defaults to a "fit" view sized in vw/vh (viewport-relative units), which
 * the browser recomputes for the real device/window/orientation on every
 * render — there's no fixed pixel size or device check to get wrong on a
 * phone vs. a 4K monitor vs. a resized desktop window. Clicking the image
 * again toggles to true 1:1 actual-pixel size (scrollable, for genuinely
 * inspecting fine detail) and back. Native pinch-zoom/trackpad-zoom still
 * works in either mode in every browser, since nothing here touches the
 * viewport meta or blocks default gestures.
 *
 * Deliberately skipped, so this stays a genuine feature rather than a
 * nuisance:
 *   - Images inside a link or button (`closest('a, button, [role="button"]')`)
 *     — clicking those already does something real (navigate, submit);
 *     this must not hijack that click.
 *   - Small images (natural size under 48px either dimension) — icons,
 *     logo marks, small avatars. There's nothing meaningful to view larger
 *     for a 24px icon, and popping a full-screen modal for one would be
 *     irritating, not useful.
 *   - Anything explicitly opted out via a data-no-lightbox attribute.
 *   - Anywhere a component's own onClick already calls stopPropagation —
 *     native bubbling means this listener (attached on `document`, so it
 *     fires last) never sees that click at all, which is exactly the
 *     right behaviour: an image with its own deliberate click handler
 *     keeps it, undisturbed.
 */
export function ImageLightbox() {
  const [active, setActive] = useState<LightboxState | null>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (target.closest('a, button, [role="button"], [data-no-lightbox]')) return;
      if (target.naturalWidth < 48 || target.naturalHeight < 48) return;

      setZoomed(false); // always open fresh in the fit-to-screen view
      setActive({ src: target.currentSrc || target.src, alt: target.alt || '' });
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const close = useCallback(() => setActive(null), []);
  const toggleZoom = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomed(z => !z);
  }, []);

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
      {/* Deliberately a plain <img>, not next/image — the point of "actual
          size" mode is the real, native-resolution file at 1:1 pixel
          scale, not an optimizer-resized copy.
          Fit mode: constrained in vw/vh, so it auto-adjusts to whatever
          screen/window this happens to be open on — no media queries or
          device checks needed, the browser recomputes these every layout.
          Zoomed mode: unconstrained, true actual size — a large image
          scrolls within the overlay (overflow-auto above) rather than
          being shrunk to fit; a small image just renders small either
          way. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={active.src}
        alt={active.alt}
        onClick={toggleZoom}
        className={`shadow-2xl ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
        style={zoomed
          ? { maxWidth: 'none', maxHeight: 'none' }
          : { maxWidth: '90vw', maxHeight: '85vh', width: 'auto', height: 'auto' }}
      />
      <div
        onClick={e => e.stopPropagation()}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 max-w-[90vw]"
      >
        {active.alt && (
          <p className="px-3 py-1.5 rounded-full bg-slate-900/80 text-white text-xs truncate max-w-full cursor-default">
            {active.alt}
          </p>
        )}
        <p className="px-2.5 py-1 rounded-full bg-slate-900/60 text-slate-300 text-[10px] cursor-default">
          {zoomed ? 'Tap/click image to fit screen' : 'Tap/click image for actual size'}
        </p>
      </div>
    </div>
  );
}
