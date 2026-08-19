/**
 * WelfordStats — online mean and variance using Welford's one-pass algorithm.
 *
 * Uses a sliding window (maxSamples) so the baseline adapts to the speaker
 * as the session progresses — early calibration doesn't permanently bias
 * detection against faster or slower speakers.
 */
export class WelfordStats {
  private readonly maxSamples: number;
  private window: number[] = [];
  private _mean = 0;
  private _M2   = 0;
  private _n    = 0;

  constructor(maxSamples = 60) {
    this.maxSamples = maxSamples;
  }

  update(value: number): void {
    if (this._n >= this.maxSamples) {
      // Evict oldest value using reverse Welford formula
      const old = this.window.shift()!;
      const nNew = this._n - 1;
      const meanOld = this._mean;
      const meanNew = nNew === 0 ? 0 : (this._mean * this._n - old) / nNew;
      this._M2 -= (old - meanOld) * (old - meanNew);
      this._mean = meanNew;
      this._n = nNew;
    }

    // Add new value
    this._n++;
    const delta  = value - this._mean;
    this._mean  += delta / this._n;
    const delta2 = value - this._mean;
    this._M2    += delta * delta2;
    this.window.push(value);
  }

  get count(): number  { return this._n; }
  get mean(): number   { return this._mean; }
  get variance(): number {
    return this._n < 2 ? 0 : this._M2 / (this._n - 1);
  }
  get stddev(): number { return Math.sqrt(this.variance); }

  reset(): void {
    this.window = [];
    this._mean  = 0;
    this._M2    = 0;
    this._n     = 0;
  }
}
