/**
 * All sound in the game, synthesized at runtime. No audio files.
 *
 * Every effect is a few oscillators and an envelope, which keeps the game a
 * single small download and means sounds are tuned by editing numbers rather
 * than by opening an audio editor.
 *
 * Two mobile-specific rules drive the structure:
 *  - The AudioContext can't exist until a user gesture, so it's created lazily
 *    on the first input rather than at startup.
 *  - A context can get suspended when the app is backgrounded, so every sound
 *    checks and resumes rather than silently failing forever after.
 *
 * The palette's value rule has an audio counterpart, and it is the one thing to
 * hold onto when adding a sound here: **things going well are bright and
 * rising; things going wrong are low and falling.** A child who isn't reading
 * the board can still hear whether the last thing she did worked.
 *
 * One sound in here is load-bearing rather than decorative. `deny` fires when a
 * placement is refused, and it must be clearly audible and clearly different
 * from every success sound. Silence, to a five-year-old, means the game is
 * broken — she will tap the same illegal cell twenty more times rather than try
 * a different one.
 */

export type Sfx =
  | 'select'
  | 'place'
  | 'deny'
  | 'refund'
  | 'sweep'
  | 'collect'
  | 'bubble'
  | 'water'
  | 'down'
  | 'shrug'
  | 'shield'
  | 'toy-lost'
  | 'wave'
  | 'big-wave'
  | 'light'
  | 'powder'
  | 'sweeper'
  | 'boost'
  | 'squeak'
  | 'magnet'
  | 'thud'
  | 'squeeze'
  | 'win'
  | 'lose';

const MUTE_KEY = 'tower-defense.muted';

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  muted: boolean;

  constructor() {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(MUTE_KEY);
    } catch {
      // Private-mode storage failures must not stop the game starting.
    }
    this.muted = stored === '1';
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // As above: the preference is lost, the game is not.
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.01);
    }
    return this.muted;
  }

  /** Call from a real user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoise(this.ctx);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(sfx: Sfx): void {
    if (this.muted || !this.ctx || !this.master) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const t = this.ctx.currentTime;

    switch (sfx) {
      case 'select':
        // Picking a card up. Tiny, because it happens constantly.
        this.tone('square', 520, 700, t, 0.05, 0.12);
        break;
      case 'place':
        // A soft thump plus a rising chirp: something landed and it worked.
        this.tone('sine', 300, 460, t, 0.09, 0.16);
        this.noise(t, 0.05, 0.06, 700, 1400);
        break;
      case 'deny':
        // Low, short, buzzy, and nothing else in the game sounds like it. Not
        // harsh — this fires when a five-year-old makes an honest mistake, and
        // it should say "not there" rather than "wrong".
        this.tone('square', 200, 130, t, 0.11, 0.16);
        break;
      case 'refund':
        this.tone('triangle', 620, 420, t, 0.1, 0.13);
        break;
      case 'sweep':
        // A brush across the floor: two short bands of noise, high and airy,
        // with no tone at all. Tidying up is neutral — not a reward like a
        // refund and not a loss like a toy being pulled apart — and the sound
        // has to sit between those two or it will be read as one of them.
        this.noise(t, 0.09, 0.07, 2600, 1600);
        this.noise(t + 0.09, 0.11, 0.05, 1900, 1000);
        break;
      case 'collect':
        // The most frequent happy sound in the game. Bright and very short.
        this.tone('triangle', 1050, 1500, t, 0.06, 0.13);
        break;
      case 'bubble':
        // Blown, not fired. Breathy, with almost no tone.
        this.noise(t, 0.05, 0.05, 1100, 2200);
        this.tone('sine', 620, 820, t, 0.05, 0.05);
        break;
      case 'water':
        this.noise(t, 0.07, 0.075, 2400, 900);
        break;
      case 'down':
        // A kid wandering off happy: two rising notes. Deliberately a REWARD
        // sound and not an impact — nobody is being defeated here.
        this.tone('triangle', 700, 700, t, 0.07, 0.15);
        this.tone('triangle', 1040, 1040, t + 0.07, 0.13, 0.15);
        break;
      case 'shrug':
        // Water off a hood: a dull, damp tap. Says "that did nothing".
        this.tone('sine', 240, 180, t, 0.07, 0.1);
        this.noise(t, 0.04, 0.03, 500);
        break;
      case 'shield':
        this.noise(t, 0.12, 0.16, 800, 300);
        this.tone('square', 300, 160, t, 0.12, 0.14);
        break;
      case 'toy-lost':
        // Low and falling. The one thing on the board that genuinely went wrong.
        this.tone('sawtooth', 300, 70, t, 0.3, 0.24);
        this.noise(t, 0.18, 0.16, 900, 250);
        break;
      case 'wave':
        this.tone('sine', 480, 620, t, 0.13, 0.12);
        break;
      case 'big-wave':
        // Three notes climbing. The only sound in the game that takes its time.
        this.tone('triangle', 400, 400, t, 0.13, 0.19);
        this.tone('triangle', 520, 520, t + 0.14, 0.13, 0.19);
        this.tone('triangle', 660, 660, t + 0.28, 0.24, 0.2);
        break;
      case 'light':
        // A wide, bright shimmer. The panic button should feel like relief.
        this.tone('triangle', 900, 1600, t, 0.28, 0.2);
        this.noise(t, 0.22, 0.08, 3600);
        break;
      case 'powder':
        this.noise(t, 0.26, 0.2, 1800, 600);
        this.tone('sine', 420, 220, t, 0.2, 0.12);
        break;
      case 'sweeper':
        this.noise(t, 0.35, 0.18, 2600, 500);
        this.tone('triangle', 760, 1200, t, 0.2, 0.16);
        break;
      case 'boost':
        // A bubble going through the bath and coming out big: the bubble sound
        // an octave down and twice as long. Deliberately the SAME sound family
        // as an ordinary bubble, because that is the point being made.
        this.noise(t, 0.07, 0.05, 700, 1400);
        this.tone('sine', 310, 470, t, 0.09, 0.09);
        break;
      case 'squeak':
        // Two rubber squeaks, up then down. The only comedy sound in the game,
        // and it should be — a kid has just been completely distracted.
        this.tone('square', 1100, 1500, t, 0.06, 0.13);
        this.tone('square', 1400, 900, t + 0.07, 0.08, 0.11);
        break;
      case 'magnet':
        // A metallic snatch: a short rasp with a bright ping on top, so it is
        // audibly something being TAKEN rather than something breaking.
        this.noise(t, 0.09, 0.1, 3000, 1200);
        this.tone('square', 380, 1300, t, 0.1, 0.12);
        break;
      case 'thud':
        // A shot hitting a stack of cardboard. Dull, low and completely dead —
        // it is a close cousin of 'shrug' on purpose, because it means the same
        // thing to the player: that did nothing, move it.
        this.noise(t, 0.05, 0.05, 320);
        this.tone('sine', 190, 130, t, 0.06, 0.09);
        break;
      case 'squeeze':
        // A cuddle that went too far: a squeak, then a descending sigh.
        this.tone('square', 900, 520, t, 0.1, 0.2);
        this.tone('sine', 340, 150, t + 0.1, 0.3, 0.18);
        break;
      case 'win':
        this.tone('triangle', 660, 660, t, 0.11, 0.2);
        this.tone('triangle', 880, 880, t + 0.12, 0.11, 0.2);
        this.tone('triangle', 1320, 1320, t + 0.24, 0.34, 0.22);
        break;
      case 'lose':
        this.tone('sawtooth', 420, 60, t, 0.7, 0.28);
        this.noise(t, 0.4, 0.14, 1100, 200);
        break;
    }
  }

  /** Pitch-swept oscillator with a percussive envelope. */
  private tone(
    type: OscillatorType,
    fromHz: number,
    toHz: number,
    start: number,
    duration: number,
    peak: number,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromHz, start);
    if (toHz !== fromHz) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), start + duration);
    }

    // Fast attack, exponential decay. A linear fade sounds like a synthesizer;
    // an exponential one sounds like something was struck.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  /** Band-limited noise burst, optionally sweeping the filter. */
  private noise(
    start: number,
    duration: number,
    peak: number,
    filterFrom: number,
    filterTo?: number,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noiseBuffer) return;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFrom, start);
    if (filterTo !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(1, filterTo), start + duration);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  /** One second of white noise, reused by every noise-based effect. */
  private createNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
