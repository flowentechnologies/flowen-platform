/**
 * WavEncoder
 *
 * Accumulates base64-encoded 16-bit PCM frames from the FlowenAudio native
 * module and assembles them into a base64-encoded WAV for upload to the
 * /api/practice/asr endpoint.
 *
 * Each frame from onPCMFrame is 320 bytes (160 samples × 2 bytes) of raw
 * Int16 LE PCM at 16 000 Hz, mono.
 */

const SAMPLE_RATE  = 16_000;
const NUM_CHANNELS = 1;
const BIT_DEPTH    = 16;

export class WavEncoder {
  private chunks: string[] = [];
  private byteCount = 0;

  /** Append one base64-encoded PCM frame (320 bytes). */
  push(base64Frame: string): void {
    this.chunks.push(base64Frame);
    // base64 encodes 3 bytes → 4 chars; each frame is 320 bytes
    this.byteCount += Math.floor((base64Frame.length * 3) / 4);
  }

  /** Number of accumulated PCM bytes. */
  get bytes(): number { return this.byteCount; }

  /** Accumulated duration in seconds. */
  get durationSeconds(): number {
    return this.byteCount / (SAMPLE_RATE * NUM_CHANNELS * (BIT_DEPTH / 8));
  }

  /** Reset accumulated frames. */
  reset(): void {
    this.chunks = [];
    this.byteCount = 0;
  }

  /**
   * Build a WAV file from the accumulated frames and return it as a base64
   * string. Resets the accumulator after flushing.
   *
   * Returns null if no frames have been accumulated.
   */
  flush(): string | null {
    if (this.chunks.length === 0) return null;

    // Decode all base64 chunks to binary strings, concatenate
    let pcmBinary = '';
    for (const b64 of this.chunks) {
      pcmBinary += atob(b64);
    }
    this.reset();

    const pcmBytes   = pcmBinary.length;
    const wavBytes   = 44 + pcmBytes;
    const byteRate   = SAMPLE_RATE * NUM_CHANNELS * (BIT_DEPTH / 8);
    const blockAlign = NUM_CHANNELS * (BIT_DEPTH / 8);

    // Build WAV header (44 bytes, little-endian)
    const header = new ArrayBuffer(44);
    const view   = new DataView(header);

    const enc = (s: string, off: number) => {
      for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    };

    enc('RIFF', 0);
    view.setUint32(4,  wavBytes - 8,        true);
    enc('WAVE', 8);
    enc('fmt ', 12);
    view.setUint32(16, 16,                  true); // PCM chunk size
    view.setUint16(20, 1,                   true); // PCM format
    view.setUint16(22, NUM_CHANNELS,        true);
    view.setUint32(24, SAMPLE_RATE,         true);
    view.setUint32(28, byteRate,            true);
    view.setUint16(32, blockAlign,          true);
    view.setUint16(34, BIT_DEPTH,           true);
    enc('data', 36);
    view.setUint32(40, pcmBytes,            true);

    // Convert header ArrayBuffer → binary string
    const headerBytes = new Uint8Array(header);
    let headerBinary  = '';
    for (let i = 0; i < headerBytes.length; i++) {
      headerBinary += String.fromCharCode(headerBytes[i]);
    }

    return btoa(headerBinary + pcmBinary);
  }
}
