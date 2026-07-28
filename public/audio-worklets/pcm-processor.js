/**
 * FlowenPCMProcessor — AudioWorkletProcessor
 *
 * Runs on a dedicated background audio thread (AudioWorkletGlobalScope).
 * Zero-allocation: pre-allocated Float32Array pool + transferable ArrayBuffers
 * eliminate GC pressure during recording sessions.
 *
 * Downsamples from the native AudioContext sample rate (44.1kHz / 48kHz)
 * to 16kHz using linear interpolation. Emits 160-sample frames (10ms) —
 * the standard speech-processing frame size used by WebRTC and most STT engines.
 *
 * ── Protocol ─────────────────────────────────────────────────────────────────
 * Messages → main thread:
 *   { type: 'pcm',    frame: Float32Array, rms: number }  — 10ms audio frame
 *   { type: 'active', value: boolean }                    — VAD state change
 *   { type: 'ready' }                                     — worklet initialized
 *
 * Messages ← main thread:
 *   { type: 'return', buffer: ArrayBuffer }               — reclaim pool buffer
 *   { type: 'stop' }                                      — halt processing
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TARGET_RATE    = 16000;   // Hz
const FRAME_SAMPLES  = 160;     // 10ms at 16kHz
const POOL_SIZE      = 8;       // covers 80ms of in-flight frames
const VAD_THRESHOLD  = 0.005;   // RMS floor for voice activity detection

class FlowenPCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // sampleRate is a read-only global in AudioWorkletGlobalScope
    this._ratio    = sampleRate / TARGET_RATE;
    this._FRAME    = FRAME_SAMPLES;
    this._running  = true;

    // ── Pre-allocate output buffer pool ──────────────────────────────────────
    // In steady state, process() never calls `new Float32Array`.
    // Pool buffers are transferred to main thread and returned via port messages.
    this._pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      this._pool.push(new Float32Array(this._FRAME));
    }
    this._outFrame  = this._pool.pop();
    this._writePos  = 0;

    // ── Linear interpolation downsampler state ───────────────────────────────
    // _phase counts input samples consumed toward the next output sample.
    // Rolls over every `_ratio` input samples.
    this._phase = 0.0;
    this._prev  = 0.0;   // last input sample (for interpolation across blocks)

    // ── RMS accumulator ──────────────────────────────────────────────────────
    // Accumulated over the current output frame; reset on each _flush().
    this._rmsAccum = 0.0;

    // ── VAD state ────────────────────────────────────────────────────────────
    this._active = false;

    this.port.onmessage = (ev) => {
      if (!ev.data) return;
      switch (ev.data.type) {
        case 'return':
          // Main thread returning a used buffer — restore to pool
          if (ev.data.buffer instanceof ArrayBuffer) {
            this._pool.push(new Float32Array(ev.data.buffer));
          }
          break;
        case 'stop':
          this._running = false;
          break;
      }
    };

    this.port.postMessage({ type: 'ready' });
  }

  /**
   * Transfers the completed output frame to the main thread, zero-copy.
   * Picks the next frame buffer from the pool; falls back to allocation
   * only if the pool is exhausted (should not happen in normal operation).
   */
  _flush() {
    const rms = Math.sqrt(this._rmsAccum / this._FRAME);
    this._rmsAccum = 0.0;

    // VAD: notify main thread only on state transitions
    const active = rms > VAD_THRESHOLD;
    if (active !== this._active) {
      this._active = active;
      this.port.postMessage({ type: 'active', value: active });
    }

    // Transfer ownership of the ArrayBuffer — main thread receives a live view,
    // this side's reference is detached. No copy occurs.
    this.port.postMessage(
      { type: 'pcm', frame: this._outFrame, rms },
      [this._outFrame.buffer]
    );

    this._outFrame = this._pool.length > 0
      ? this._pool.pop()
      : new Float32Array(this._FRAME);   // fallback allocation (pool starvation)
    this._writePos = 0;
  }

  /**
   * Called by the browser's audio rendering thread every ~2.67ms (128 frames
   * at 48kHz). Must complete within this budget; no allocations, no I/O.
   */
  process(inputs) {
    if (!this._running) return false;

    const ch = inputs[0]?.[0];
    if (!ch || ch.length === 0) return true;

    const ratio  = this._ratio;
    const FRAME  = this._FRAME;
    const len    = ch.length;

    for (let i = 0; i < len; i++) {
      const curr = ch[i];
      this._phase += 1.0;

      // Emit one output sample for each `ratio` input samples consumed.
      // Linear interpolation between _prev and curr for sub-sample accuracy.
      while (this._phase >= ratio) {
        this._phase -= ratio;

        // Fractional position of the output sample within the current
        // input interval [_prev, curr]: t=0 → _prev, t=1 → curr
        const t      = this._phase / ratio;
        const sample = this._prev + t * (curr - this._prev);

        this._outFrame[this._writePos] = sample;
        this._rmsAccum += sample * sample;
        this._writePos++;

        if (this._writePos >= FRAME) {
          this._flush();
        }
      }

      this._prev = curr;
    }

    return true;
  }
}

registerProcessor('flowen-pcm-processor', FlowenPCMProcessor);
