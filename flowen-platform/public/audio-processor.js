class PCMAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048; // ~42.6ms at 48kHz
    this.buffer = new Float32Array(this.bufferSize);
    this.bytesWritten = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputChannel = input[0];
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bytesWritten++] = inputChannel[i];

      if (this.bytesWritten >= this.bufferSize) {
        this.sendAudioChunk();
        this.bytesWritten = 0;
      }
    }
    return true;
  }

  sendAudioChunk() {
    let sumSquares = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      sumSquares += this.buffer[i] * this.buffer[i];
    }
    const rms = Math.sqrt(sumSquares / this.buffer.length);

    this.port.postMessage({
      type: 'AUDIO_CHUNK',
      pcmData: this.buffer.slice(0),
      rms: rms,
      timestamp: currentTime
    });
  }
}

registerProcessor('pcm-audio-processor', PCMAudioProcessor);
