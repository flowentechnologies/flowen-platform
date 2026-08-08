'use client';

// =============================================================================
// CameraFeed — mirrored camera preview for the face-tracking PiP overlay
//
// Renders the live camera <video> element that useFaceTracker drives.  The
// element is always present in the DOM (the hook's videoRef must stay mounted
// throughout an active tracking session), but is visually hidden via
// `visibility: hidden; width: 0; height: 0` while inactive so it takes up no
// layout space and MediaPipe can still read frames.
// =============================================================================

import type { RefObject } from 'react';
import type { FaceTrackerStatus } from '@/lib/hooks/useFaceTracker';

interface CameraFeedProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  status:   FaceTrackerStatus;
}

export function CameraFeed({ videoRef, status }: CameraFeedProps) {
  const active = status === 'active';

  return (
    <>
      {/* The video element must always be in the DOM so MediaPipe can read
          frames via the ref; visibility:hidden + zero size hides it without
          removing it while the tracker is idle/loading/denied. */}
      <video
        ref={videoRef as RefObject<HTMLVideoElement>}
        playsInline
        muted
        autoPlay
        aria-hidden="true"
        style={{
          // Mirror horizontally so the user sees a natural "mirror" view
          transform:  'scaleX(-1)',
          visibility: active ? 'visible' : 'hidden',
          // Zero dimensions when not active so no phantom space is reserved
          width:      active ? '100%'   : 0,
          height:     active ? '100%'   : 0,
          objectFit:  'cover',
          display:    'block',
        }}
      />

      {/* Recording badge — visible only while active */}
      {active && (
        <div
          className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400">
            Camera
          </span>
        </div>
      )}
    </>
  );
}
