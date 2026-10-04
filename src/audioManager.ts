export class ArcadeAudioManager {
  private ctx: AudioContext | null = null;
  private isEnabled = false;
  private nextPlayTime = 0;
  private sampleRate = 44100;

  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate;
  }

  public toggleAudio(): boolean {
    if (this.isEnabled) {
      this.mute();
      return false;
    } else {
      this.enable();
      return true;
    }
  }

  public async enable(): Promise<void> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: this.sampleRate });
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.isEnabled = true;
    this.nextPlayTime = this.ctx.currentTime + 0.05;
  }

  public mute(): void {
    this.isEnabled = false;
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }

  public get active(): boolean {
    return this.isEnabled;
  }

  public playChunk(leftSamples: Float32Array, rightSamples: Float32Array) {
    if (!this.isEnabled || !this.ctx || this.ctx.state !== 'running') return;

    const length = leftSamples.length;
    const buffer = this.ctx.createBuffer(2, length, this.sampleRate);
    buffer.copyToChannel(leftSamples as any, 0);
    buffer.copyToChannel(rightSamples as any, 1);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);

    const currentTime = this.ctx.currentTime;
    if (this.nextPlayTime < currentTime) {
      this.nextPlayTime = currentTime + 0.01;
    }

    source.start(this.nextPlayTime);
    this.nextPlayTime += buffer.duration;
  }
}
