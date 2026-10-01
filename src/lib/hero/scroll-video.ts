/** Scroll progress is tied to the visible hero, not a second, empty viewport. */
export function heroProgress(top: number, height: number): number {
  if (!Number.isFinite(top) || !Number.isFinite(height) || height <= 0) return 0;
  return Math.min(1, Math.max(0, -top / height));
}

export function frameTime(progress: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  // Seeking exactly to duration can show an empty/ended frame in some browsers.
  return Math.min(1, Math.max(0, progress)) * Math.max(0, duration - 1 / 30);
}

/** One seek at a time. A newer scroll target replaces, rather than queues, old work. */
export function createScrollVideoController(video: HTMLVideoElement) {
  let progress = 0;
  let disposed = false;
  let lastRequested = -1;
  const seek = () => {
    if (disposed || video.seeking || video.readyState < 2) return;
    const target = frameTime(progress, video.duration);
    if (Math.abs(video.currentTime - target) < 1 / 30 || Math.abs(lastRequested - target) < 1 / 30) return;
    lastRequested = target;
    try { video.currentTime = target; } catch { /* Keep the poster on unavailable media. */ }
  };
  video.pause();
  video.addEventListener('loadeddata', seek);
  video.addEventListener('durationchange', seek);
  video.addEventListener('seeked', seek);
  return {
    update(next: number) { progress = next; seek(); },
    dispose() {
      disposed = true;
      video.pause();
      video.removeEventListener('loadeddata', seek);
      video.removeEventListener('durationchange', seek);
      video.removeEventListener('seeked', seek);
    },
  };
}
