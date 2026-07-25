export class AudioStreamClient {
  private ws: WebSocket | null = null;
  private isConnected = false;

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.isConnected = true;
        resolve();
      };

      this.ws.onerror = (err) => reject(err);
      this.ws.onclose = () => {
        this.isConnected = false;
      };
    });
  }

  sendPCMChunk(pcmData: Float32Array): void {
    if (this.ws && this.isConnected) {
      this.ws.send(pcmData.buffer);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.isConnected = false;
    }
  }
}
