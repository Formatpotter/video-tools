export class VideoDecodePipeline {
  constructor(config, onFrame, onError) {
    this.decoder = new VideoDecoder({
      output: (frame) => onFrame(frame),
      error: (e) => (onError ? onError(e) : console.error('Decode error:', e)),
    });
    this.decoder.configure(config);
    this.pending = 0;
  }

  decode(packet) {
    if (this.decoder.state !== 'configured') return;
    const chunk = new EncodedVideoChunk({
      type: packet.isKey ? 'key' : 'delta',
      timestamp: packet.timestamp,
      duration: packet.duration,
      data: packet.data,
    });
    this.decoder.decode(chunk);
    this.pending++;
  }

  async flush() {
    if (this.decoder.state === 'configured') await this.decoder.flush();
  }

  close() {
    try { if (this.decoder.state !== 'closed') this.decoder.close(); } catch (_) {}
  }
}

export class AudioDecodePipeline {
  constructor(config, onAudioData, onError) {
    this.decoder = new AudioDecoder({
      output: (data) => onAudioData(data),
      error: (e) => (onError ? onError(e) : console.error('Audio decode error:', e)),
    });
    this.decoder.configure(config);
  }

  decode(packet) {
    if (this.decoder.state !== 'configured') return;
    const chunk = new EncodedAudioChunk({
      type: packet.isKey ? 'key' : 'delta',
      timestamp: packet.timestamp,
      duration: packet.duration,
      data: packet.data,
    });
    this.decoder.decode(chunk);
  }

  async flush() {
    if (this.decoder.state === 'configured') await this.decoder.flush();
  }

  close() {
    try { if (this.decoder.state !== 'closed') this.decoder.close(); } catch (_) {}
  }
}
