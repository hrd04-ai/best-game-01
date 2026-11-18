// NOVA KEEPER — every sound is synthesized with WebAudio: no audio files,
// no network, just oscillators and filtered noise. The context is created on
// the first user gesture (browsers require it); every call is safe before
// then and while muted, so headless screenshot runs stay silent and error-free.

const MUSIC_NOTES = [110.0, 130.81, 164.81, 196.0]; // A2 C3 E3 G3, a slow pad
const FANFARE = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6

/** The sound engine: one master gain, one music loop, one-shot effects. */
export class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.lastGemAt = 0;
    this.gemStreak = 0;
  }

  /** Create (or resume) the audio context. Call from a user gesture. */
  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.context) {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      this.context = new AC();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.context.destination);
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  /** Mute or unmute everything; returns the new state. */
  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.context.currentTime, 0.02);
    }
    return this.muted;
  }

  /** Start the slow ambient pad loop (safe to call repeatedly). */
  startMusic() {
    if (!this.context || this.musicTimer !== null) return;
    const playStep = () => {
      if (!this.context || this.muted) return;
      const note = MUSIC_NOTES[this.musicStep % MUSIC_NOTES.length];
      this.musicStep += 1;
      const t = this.context.currentTime;
      for (const detune of [-4, 4]) {
        const osc = this.context.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = note;
        osc.detune.value = detune;
        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.9);
        gain.gain.linearRampToValueAtTime(0, t + 3.6);
        osc.connect(gain).connect(this.musicGain);
        osc.start(t);
        osc.stop(t + 3.8);
      }
    };
    playStep();
    this.musicTimer = setInterval(playStep, 2400);
  }

  /** Stop the music loop. */
  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  /** A short oscillator blip: the building block of most effects. */
  blip({ type = 'sine', from = 440, to = 440, seconds = 0.12, volume = 0.3, when = 0 }) {
    if (!this.context || this.muted) return;
    const t = this.context.currentTime + when;
    const osc = this.context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + seconds);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  /** A burst of filtered noise: hits, explosions, the boss warning. */
  noise({ seconds = 0.2, volume = 0.3, cutoff = 1200, when = 0 }) {
    if (!this.context || this.muted) return;
    const t = this.context.currentTime + when;
    const length = Math.max(1, Math.floor(this.context.sampleRate * seconds));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t);
  }

  shoot() {
    this.blip({ type: 'square', from: 880, to: 520, seconds: 0.07, volume: 0.06 });
  }

  enemyHit() {
    this.noise({ seconds: 0.06, volume: 0.1, cutoff: 2400 });
  }

  enemyDie() {
    this.blip({ type: 'sawtooth', from: 320, to: 60, seconds: 0.18, volume: 0.16 });
    this.noise({ seconds: 0.14, volume: 0.12, cutoff: 900 });
  }

  /** Gem pickups rise in pitch while the player keeps collecting. */
  gem() {
    const now = performance.now();
    this.gemStreak = now - this.lastGemAt < 900 ? this.gemStreak + 1 : 0;
    this.lastGemAt = now;
    const step = Math.min(this.gemStreak, 12);
    this.blip({ type: 'sine', from: 660 * Math.pow(1.059, step), to: 990 * Math.pow(1.059, step), seconds: 0.09, volume: 0.14 });
  }

  levelUp() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.blip({ type: 'triangle', from: freq, to: freq, seconds: 0.16, volume: 0.2, when: i * 0.07 });
    });
  }

  hurt() {
    this.blip({ type: 'sawtooth', from: 160, to: 55, seconds: 0.25, volume: 0.3 });
    this.noise({ seconds: 0.2, volume: 0.2, cutoff: 500 });
  }

  bossWarn() {
    this.blip({ type: 'sawtooth', from: 98, to: 98, seconds: 0.5, volume: 0.25 });
    this.blip({ type: 'sawtooth', from: 98, to: 98, seconds: 0.5, volume: 0.25, when: 0.6 });
  }

  /** A relic claimed: a bright rising arpeggio. */
  relic() {
    [659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
      this.blip({ type: 'triangle', from: freq, to: freq, seconds: 0.22, volume: 0.2, when: i * 0.08 });
    });
  }

  /** The sky darkens into a new phase: a low chord swell. */
  phase() {
    this.blip({ type: 'sine', from: 130.81, to: 98, seconds: 0.9, volume: 0.22 });
    this.blip({ type: 'sine', from: 196, to: 164.81, seconds: 0.9, volume: 0.16, when: 0.1 });
  }

  victory() {
    FANFARE.forEach((freq, i) => {
      this.blip({ type: 'triangle', from: freq, to: freq, seconds: 0.4, volume: 0.22, when: i * 0.14 });
    });
  }

  gameOver() {
    [392, 311.13, 261.63].forEach((freq, i) => {
      this.blip({ type: 'triangle', from: freq, to: freq * 0.94, seconds: 0.5, volume: 0.2, when: i * 0.22 });
    });
  }
}
