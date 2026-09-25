/**
 * Demuxer — extracts encoded video/audio packets from MP4/WebM/MOV
 * Uses web-demuxer (WASM) for container parsing.
 * License: MIT
 */

const WEB_DEMUXER_URL = 'https://cdn.jsdelivr.net/npm/web-demuxer@1.4.1/dist/web-demuxer.js';

let _webDemuxerLoaded = null;
async function ensureWebDemuxer() {
  if (_webDemuxerLoaded) return _webDemuxerLoaded;
  _webDemuxerLoaded = import(WEB_DEMUXER_URL);
  return _webDemuxerLoaded;
}

export class Demuxer {
  constructor() {
    this.demuxer = null;
    this.videoTrack = null;
    this.audioTrack = null;
    this.duration = 0;
  }

  async load(file) {
    const { WebDemuxer } = await ensureWebDemuxer();
    this.demuxer = new WebDemuxer({ wasmFilePath: 'https://cdn.jsdelivr.net/npm/web-demuxer@1.4.1/dist/web-demuxer.wasm' });
    await this.demuxer.load(file);

    const info = this.demuxer.getMediaInfo();
    this.duration = info.duration || 0;

    for (const track of info.streams) {
      if (track.codec_type === 'video' && !this.videoTrack) this.videoTrack = track;
      if (track.codec_type === 'audio' && !this.audioTrack) this.audioTrack = track;
    }

    if (!this.videoTrack) throw new Error('No video track found in this file.');

    return {
      video: this.videoTrack,
      audio: this.audioTrack,
      duration: this.duration,
    };
  }

  getVideoDecoderConfig() {
    const t = this.videoTrack;
    return {
      codec: t.codec_string || this._mapCodec(t.codec_name),
      codedWidth: t.width,
      codedHeight: t.height,
      description: t.extradata ? new Uint8Array(t.extradata) : undefined,
    };
  }

  getAudioDecoderConfig() {
    if (!this.audioTrack) return null;
    const t = this.audioTrack;
    return {
      codec: t.codec_string || this._mapCodec(t.codec_name),
      sampleRate: t.sample_rate,
      numberOfChannels: t.channels,
      description: t.extradata ? new Uint8Array(t.extradata) : undefined,
    };
  }

  _mapCodec(name) {
    const map = {
      h264: 'avc1.640028',
      hevc: 'hvc1.1.6.L93.B0',
      vp8: 'vp8',
      vp9: 'vp09.00.10.08',
      av1: 'av01.0.04M.08',
      aac: 'mp4a.40.2',
      mp3: 'mp3',
      opus: 'opus',
    };
    return map[name] || name;
  }

  async *streamPackets(startUs = 0, endUs = Infinity) {
    const reader = this.demuxer.read();
    for await (const packet of reader) {
      if (packet.timestamp < startUs) continue;
      if (packet.timestamp > endUs) break;
      yield {
        type: packet.type,
        timestamp: packet.timestamp,
        duration: packet.duration,
        data: packet.data,
        isKey: packet.isKey,
      };
    }
  }

  destroy() {
    try { this.demuxer?.destroy?.(); } catch (_) {}
  }
}
