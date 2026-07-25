class FlowenPCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 320;
    this.buffer = new Float32Array(this.bufferSize);
    this.bytesWritten = 0;
  }

  process(inputs) {
    const input = inputs[0][0];
    if (!input) return true;

    const inputLen = input.length;
    for (let i = 0; i < inputLen; i++) {
      this.buffer[this.bytesWritten++] = input[i];
      if (this.bytesWritten >= this.bufferSize) {
        this.port.postMessage(this.buffer.slice(0, this.bufferSize));
        this.bytesWritten = 0;
      }
    }
    return true;
  }
}

registerProcessor('flowen-pcm-processor', FlowenPCMProcessor);
