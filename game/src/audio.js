// WebAudio sound effects + a small generative music loop. Synthesized only,
// no audio files. One job: sound. Safe to call before any user gesture —
// the context is created lazily on the first gesture.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicOn = false;
    this.musicTimer = null;
    this.step = 0;
    this.nextStepTime = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
    } catch { return false; }
    return true;
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
  // --- one-shot effects ---
  tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  noise(dur, vol = 0.25, low = 800, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = low;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }
  shoot()  { this.tone(720, 0.09, 'square', 0.10, 240); }
  hit()    { this.noise(0.06, 0.12, 2400); }
  kill()   { this.noise(0.18, 0.22, 1200); this.tone(180, 0.16, 'triangle', 0.18, 60); }
  pickup() { this.tone(880, 0.07, 'sine', 0.14, 1320); }
  hurt()   { this.tone(220, 0.25, 'sawtooth', 0.22, 70); this.noise(0.12, 0.15, 600); }
  buy()    { this.tone(660, 0.08, 'sine', 0.16); this.tone(990, 0.12, 'sine', 0.16, null, 0.07); }
  wave()   { this.tone(392, 0.18, 'triangle', 0.18); this.tone(523, 0.22, 'triangle', 0.18, null, 0.12); }
  boss()   { this.tone(98, 0.5, 'sawtooth', 0.22, 49); this.noise(0.4, 0.18, 400); }
  win()    { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.2, null, i * 0.13)); }
  lose()   { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.32, 'triangle', 0.18, null, i * 0.16)); }
  // --- generative music: A-minor step sequencer, 8th notes at 112 BPM ---
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.1;
    const bass = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 73.42, 0];
    const arp = [220, 261.63, 329.63, 440, 329.63, 261.63, 220, 174.61, 196, 246.94, 293.66, 392, 329.63, 246.94, 220, 196];
    const stepDur = 60 / 112 / 2;
    const tick = () => {
      if (!this.musicOn || !this.ctx) return;
      while (this.nextStepTime < this.ctx.currentTime + 0.25) {
        const s = this.step % 16;
        const delay = Math.max(0, this.nextStepTime - this.ctx.currentTime);
        if (bass[s]) this.toneAt(bass[s], stepDur * 0.95, 'triangle', 0.5, delay, this.musicGain);
        if (this.step % 2 === 0) this.toneAt(arp[s], stepDur * 0.8, 'sine', 0.16, delay, this.musicGain);
        if (s === 0 || s === 8) this.toneAt(110, 0.05, 'square', 0.08, delay, this.musicGain);
        this.step++;
        this.nextStepTime += stepDur;
      }
    };
    this.musicTimer = setInterval(tick, 90);
  }
  toneAt(freq, dur, type, vol, delay, dest) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
