import { ambience, synth, SFX_KINDS, type AmbienceKind, type SfxKind } from './sfx';

/**
 * All sound in the game: synthesised effects and room tone (sfx.ts), plus
 * recorded voices and music when `public/sounds/` has them (DECISIONS 67).
 *
 * Two mobile-specific rules drive the structure, unchanged since the first
 * version:
 *  - The AudioContext can't exist until a user gesture, so it's created lazily
 *    on the first input rather than at startup.
 *  - A context can get suspended when the app is backgrounded, so every sound
 *    checks and resumes rather than silently failing forever after. On top of
 *    that the context is now suspended on purpose when the page is hidden, so
 *    the music doesn't play on from a phone in a pocket.
 *
 * The palette's value rule has an audio counterpart, and it is the one thing to
 * hold onto when adding a sound here: **things going well are bright and
 * rising; things going wrong are low and falling.** A child who isn't reading
 * the board can still hear whether the last thing she did worked.
 *
 * One sound in here is load-bearing rather than decorative. `deny` fires when a
 * placement is refused, and it must be clearly audible and clearly different
 * from every success sound. Silence, to a five-year-old, means the game is
 * broken: she will tap the same illegal cell twenty more times rather than try
 * a different one. It is the only buzz in the game, it is played dry (no
 * reverb, so it doesn't bloom like a chime), and it is never rate-limited.
 *
 * ## The mix
 *
 *     effects ─┬──────────────► sounds bus ─┐
 *              └─► reverb send ─► reverb ───┘   (sounds bus: the SOUNDS toggle)
 *     voices ─────────────────► sounds bus      ├─► master ─► compressor ─► out
 *     music ──► music bus ─► duck ──────────────┤   (music bus: the MUSIC toggle)
 *     room tone ─► ambience bus ────────────────┘   (also the MUSIC toggle)
 *
 * The compressor keeps a pile of bubbles from clipping and lets the small
 * sounds through; the reverb is one short, warm room, so every toy sounds like
 * it's in the same house. Ducking is its own node so a voice line dipping the
 * music can never fight the music toggle.
 */

export type Sfx = SfxKind;

/** Each shooter's own voice. Toys missing from here (walls, producers) never shoot. */
export const SHOOT_SFX: Partial<Record<string, SfxKind>> = {
  wand: 'shoot-wand',
  machine: 'shoot-machine',
  sprinkler: 'shoot-sprinkler',
  watergun: 'shoot-watergun',
  slushie: 'shoot-slushie',
  beachball: 'shoot-beachball',
  lobber: 'shoot-lobber',
};

/**
 * Per effect: its level in the mix and its reverb send. These are the mixing
 * desk. Gains are set against each sound's measured loudness, not its peak
 * (every buffer is peak-normalised): `deny` is a sustained buzz, about three
 * times the RMS of a chime at the same peak, so 0.45 already makes it the
 * loudest interface sound by a clear margin. It is dry on purpose.
 */
const MIX: Record<SfxKind, { gain: number; reverb: number }> = {
  select: { gain: 0.5, reverb: 0.05 },
  place: { gain: 0.6, reverb: 0.2 },
  deny: { gain: 0.45, reverb: 0 },
  refund: { gain: 0.45, reverb: 0.2 },
  sweep: { gain: 0.4, reverb: 0.1 },
  collect: { gain: 0.45, reverb: 0.25 },
  'shoot-wand': { gain: 0.22, reverb: 0.15 },
  'shoot-machine': { gain: 0.24, reverb: 0.15 },
  'shoot-sprinkler': { gain: 0.2, reverb: 0.1 },
  'shoot-watergun': { gain: 0.26, reverb: 0.1 },
  'shoot-slushie': { gain: 0.24, reverb: 0.15 },
  'shoot-beachball': { gain: 0.28, reverb: 0.15 },
  'shoot-lobber': { gain: 0.26, reverb: 0.15 },
  hit: { gain: 0.16, reverb: 0.1 },
  shrug: { gain: 0.3, reverb: 0.05 },
  shield: { gain: 0.9, reverb: 0.15 },
  down: { gain: 0.45, reverb: 0.3 },
  'toy-lost': { gain: 0.6, reverb: 0.2 },
  wave: { gain: 0.5, reverb: 0.3 },
  'big-wave': { gain: 0.6, reverb: 0.35 },
  light: { gain: 0.5, reverb: 0.4 },
  powder: { gain: 0.5, reverb: 0.3 },
  sweeper: { gain: 0.7, reverb: 0.3 },
  boost: { gain: 0.2, reverb: 0.15 },
  squeak: { gain: 0.5, reverb: 0.15 },
  magnet: { gain: 0.45, reverb: 0.2 },
  thud: { gain: 0.3, reverb: 0.05 },
  squeeze: { gain: 0.6, reverb: 0.2 },
  throw: { gain: 0.45, reverb: 0.15 },
  win: { gain: 0.6, reverb: 0.4 },
  lose: { gain: 0.55, reverb: 0.35 },
};

/** Random variants cached per effect, each replayed slightly re-pitched. */
const VARIANTS = 3;
/** Effects that must sound identical every time: re-pitching a signal blurs it. */
const STEADY: ReadonlySet<SfxKind> = new Set<SfxKind>(['deny', 'select']);

/** Music sits well under everything else: the game's sounds are the information. */
const MUSIC_LEVEL = 0.3;
const AMBIENCE_LEVEL = 0.12;
const MUSIC_FADE = 1.2;
const LOOP_XFADE = 1.5;

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private soundsBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private duckNode: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;

  /**
   * Effects and voices off. The original toggle, so a saved `muted` still
   * means what it did. Persisted by main.ts in the save, with `musicOff`.
   */
  muted = false;
  /** Music and room tone off. */
  musicOff = false;

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  toggleMusic(): boolean {
    this.setMusicOff(!this.musicOff);
    return this.musicOff;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyToggles();
  }

  setMusicOff(off: boolean): void {
    this.musicOff = off;
    this.applyToggles();
  }

  private applyToggles(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.soundsBus?.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.02);
    this.musicBus?.gain.setTargetAtTime(this.musicOff ? 0 : MUSIC_LEVEL, t, 0.1);
    this.ambienceBus?.gain.setTargetAtTime(this.musicOff ? 0 : AMBIENCE_LEVEL, t, 0.1);
  }

  /** Call from a real user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      comp.connect(ctx.destination);

      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(comp);

      this.soundsBus = ctx.createGain();
      this.soundsBus.gain.value = this.muted ? 0 : 1;
      this.soundsBus.connect(this.master);

      const reverb = ctx.createConvolver();
      reverb.buffer = this.makeReverb(ctx);
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0.8;
      this.reverbSend.connect(reverb);
      reverb.connect(this.soundsBus);

      this.duckNode = ctx.createGain();
      this.duckNode.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicOff ? 0 : MUSIC_LEVEL;
      this.musicBus.connect(this.duckNode);

      this.ambienceBus = ctx.createGain();
      this.ambienceBus.gain.value = this.musicOff ? 0 : AMBIENCE_LEVEL;
      this.ambienceBus.connect(this.master);

      this.decodeAll();
      // Build each effect's first variant now, a few milliseconds apart, so the
      // first bubble of a level doesn't hitch while it's being synthesised.
      SFX_KINDS.forEach((kind, i) =>
        setTimeout(() => {
          if ((this.sfx.get(kind)?.length ?? 0) === 0) this.variant(kind);
        }, 25 * (i + 1)),
      );

      // Hidden page: stop everything (music would otherwise play on from a
      // pocket). Visible again: carry on where it was.
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else void this.ctx.resume();
      });
    }
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
  }

  // --- Effects -------------------------------------------------------------------

  private readonly sfx = new Map<SfxKind, AudioBuffer[]>();

  private variant(kind: SfxKind): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    let variants = this.sfx.get(kind);
    if (!variants) {
      variants = [];
      this.sfx.set(kind, variants);
    }
    const limit = STEADY.has(kind) ? 1 : VARIANTS;
    if (variants.length < limit) {
      const data = synth(kind, ctx.sampleRate);
      const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buffer.getChannelData(0).set(data);
      variants.push(buffer);
      return buffer;
    }
    return variants[Math.floor(Math.random() * variants.length)]!;
  }

  /** `level` 0..1 scales the volume. */
  play(sfx: Sfx, level = 1): void {
    const ctx = this.ctx;
    if (this.muted || !ctx || !this.soundsBus) return;
    if (ctx.state === 'suspended' && !document.hidden) void ctx.resume();
    const buffer = this.variant(sfx);
    if (!buffer) return;
    const mix = MIX[sfx];
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // A little pitch wobble, so a dozen identical bubbles don't sound like a machine.
    if (!STEADY.has(sfx)) source.playbackRate.value = 0.95 + Math.random() * 0.1;
    const g = ctx.createGain();
    g.gain.value = mix.gain * Math.max(0.05, Math.min(1, level));
    source.connect(g);
    g.connect(this.soundsBus);
    if (this.reverbSend && mix.reverb > 0) {
      const send = ctx.createGain();
      send.gain.value = mix.reverb;
      g.connect(send);
      send.connect(this.reverbSend);
    }
    source.start();
  }

  /** A short, warm room: decaying noise, darkening as it fades. */
  private makeReverb(ctx: AudioContext): AudioBuffer {
    const seconds = 1.1;
    const n = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buffer.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const a = 0.55 * (1 - t) + 0.04;
        lp += (Math.random() * 2 - 1 - lp) * a;
        d[i] = lp * Math.pow(1 - t, 3) * 0.45;
      }
    }
    return buffer;
  }

  // --- Room tone --------------------------------------------------------------------

  private readonly roomTones = new Map<AmbienceKind, AudioBuffer>();
  private room: { kind: AmbienceKind; source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wantRoom: AmbienceKind | '' = '';

  /** Which room's tone to play; `''` for none. Crossfades. Cheap to call every tick. */
  setAmbience(kind: AmbienceKind | ''): void {
    if (kind === this.wantRoom) return;
    this.wantRoom = kind;
    const ctx = this.ctx;
    const bus = this.ambienceBus;
    if (!ctx || !bus) return;
    const now = ctx.currentTime;
    if (this.room) {
      const old = this.room;
      old.gain.gain.setTargetAtTime(0, now, 0.4);
      old.source.stop(now + 2);
      this.room = null;
    }
    if (!kind) return;
    let buffer = this.roomTones.get(kind);
    if (!buffer) {
      const data = ambience(kind, ctx.sampleRate);
      buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buffer.getChannelData(0).set(data);
      this.roomTones.set(kind, buffer);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.setTargetAtTime(1, now, 0.6);
    source.connect(gain);
    gain.connect(bus);
    source.start(now, Math.random() * buffer.duration);
    this.room = { kind, source, gain };
  }

  // --- Recorded sound: voices and music (scripts/generate-sound.mjs) -----------
  //
  // Optional, like the art: no index, or a file that fails, and the game plays
  // with its synthesised sounds alone. Files are fetched at startup but only
  // DECODED once the AudioContext exists, which is after the first tap.

  private readonly raw = new Map<string, ArrayBuffer>();
  private readonly buffers = new Map<string, AudioBuffer>();
  /** Cartoon speed-up per voice line, from the index: shorter and higher. */
  private readonly rates = new Map<string, number>();
  private voiceUntil = 0;
  private music: { id: string; gain: GainNode; sources: AudioBufferSourceNode[]; nextAt: number } | null = null;
  private wantMusic = '';
  private readonly loops = new Map<string, { start: number; end: number }>();

  /** Fetch the recorded sounds. Never throws; anything missing just stays synthesised or silent. */
  loadRecorded(baseUrl: string): void {
    void (async () => {
      let index: { ext?: string; voices?: string[]; music?: string[]; stings?: string[]; rates?: Record<string, number> };
      try {
        const r = await fetch(`${baseUrl}sounds/index.json`, { cache: 'no-cache' });
        if (!r.ok) return;
        index = await r.json();
      } catch {
        return;
      }
      const ext = index.ext ?? 'm4a';
      for (const [id, rate] of Object.entries(index.rates ?? {})) this.rates.set(id, rate);
      // Voices and stings first: they're small and used from the first wave.
      // Then music, title theme first since that's where she starts.
      const music = [...(index.music ?? [])].sort((a, b) => Number(b === 'music.title') - Number(a === 'music.title'));
      for (const id of [...(index.voices ?? []), ...(index.stings ?? []), ...music]) {
        try {
          const r = await fetch(`${baseUrl}sounds/${id}.${ext}`);
          if (r.ok) this.raw.set(id, await r.arrayBuffer());
        } catch {
          // One missing file loses one sound.
        }
        if (this.ctx) this.decodeAll();
      }
    })();
  }

  private decodeAll(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const [id, bytes] of this.raw) {
      this.raw.delete(id);
      void ctx.decodeAudioData(bytes).then(
        (buffer) => this.buffers.set(id, buffer),
        () => {},
      );
    }
  }

  /** True if this recorded sound is ready to play. */
  has(id: string): boolean {
    return this.buffers.has(id);
  }

  /** How many recorded sounds are decoded. For the dev check. */
  get recordedCount(): number {
    return this.buffers.size;
  }

  /**
   * Say a voice line, one of `ids` at random. Returns false if none is loaded
   * (or sound is off), so the caller can fall back or skip.
   *
   * One voice at a time: a line that would start while another is still
   * talking is dropped, unless `interrupt`. Two kids talking over each other,
   * or over Ellie, is noise; one clear line is a moment.
   */
  say(ids: readonly string[], opts: { delay?: number; gain?: number; interrupt?: boolean } = {}): boolean {
    const ctx = this.ctx;
    if (this.muted || !ctx || !this.soundsBus) return false;
    const ready = ids.filter((id) => this.buffers.has(id));
    if (ready.length === 0) return false;
    const at = ctx.currentTime + (opts.delay ?? 0);
    if (at < this.voiceUntil && !opts.interrupt) return false;
    const id = ready[Math.floor(Math.random() * ready.length)]!;
    const buffer = this.buffers.get(id)!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const rate = (this.rates.get(id) ?? 1) * (0.97 + Math.random() * 0.06);
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = opts.gain ?? 0.9;
    source.connect(gain);
    gain.connect(this.soundsBus);
    source.start(at);
    const length = buffer.duration / rate;
    this.voiceUntil = at + length;
    this.duck(0.45, length, at);
    return true;
  }

  /**
   * A short recorded one-shot (the win and lose stings). Plays on the music
   * bus, so the MUSIC toggle silences it with the music. Returns false if it
   * isn't loaded or music is off, so the caller can use the synthesised one.
   */
  sting(id: string): boolean {
    const ctx = this.ctx;
    if (this.musicOff || !ctx || !this.musicBus) return false;
    const buffer = this.buffers.get(id);
    if (!buffer) return false;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    // The music bus sits low; a sting is a moment, so it's lifted back up.
    gain.gain.value = 2.2;
    source.connect(gain);
    gain.connect(this.musicBus);
    source.start(ctx.currentTime + 0.05);
    return true;
  }

  /** Ask for a music track. Crossfades if it's different; `''` fades music out. */
  setMusic(id: string): void {
    this.wantMusic = id;
  }

  /**
   * Keep the music going. Call every tick: it starts, crossfades and loops
   * tracks by scheduling the next segment a little ahead of time.
   */
  updateMusic(): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus) return;
    const want = this.wantMusic && this.buffers.has(this.wantMusic) ? this.wantMusic : '';
    const now = ctx.currentTime;

    if (this.music && this.music.id !== want) {
      const old = this.music;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0.0001, now + MUSIC_FADE);
      for (const src of old.sources) src.stop(now + MUSIC_FADE + 0.05);
      this.music = null;
    }
    if (!want) return;
    if (!this.music) {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(1, now + MUSIC_FADE);
      gain.connect(bus);
      this.music = { id: want, gain, sources: [], nextAt: now };
    }
    // Schedule the next segment once we're within two seconds of needing it.
    const m = this.music;
    if (m.nextAt - now > 2) return;
    const buffer = this.buffers.get(m.id)!;
    const loop = this.loopOf(m.id, buffer);
    const length = loop.end - loop.start;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const seg = ctx.createGain();
    // Each segment fades in and out over the crossfade, so the overlap blends.
    // The very first segment of a track starts at full level: the track-level
    // fade above is already bringing it in.
    const t0 = Math.max(now, m.nextAt);
    const first = m.sources.length === 0;
    seg.gain.setValueAtTime(first ? 1 : 0.0001, t0);
    if (!first) seg.gain.linearRampToValueAtTime(1, t0 + LOOP_XFADE);
    seg.gain.setValueAtTime(1, t0 + length - LOOP_XFADE);
    seg.gain.linearRampToValueAtTime(0.0001, t0 + length);
    source.connect(seg);
    seg.connect(m.gain);
    source.start(t0, loop.start, length);
    m.sources = [...m.sources.slice(-2), source];
    m.nextAt = t0 + length - LOOP_XFADE;
  }

  /**
   * The steady part of a track: from where it reaches full volume to where
   * it starts to fade. Lyria clips are about thirty seconds and often fade
   * out at the end; looping the whole thing would dip to silence every lap.
   */
  private loopOf(id: string, buffer: AudioBuffer): { start: number; end: number } {
    const cached = this.loops.get(id);
    if (cached) return cached;
    const data = buffer.getChannelData(0);
    const win = Math.floor(buffer.sampleRate * 0.1);
    const rms: number[] = [];
    for (let i = 0; i + win <= data.length; i += win) {
      let sum = 0;
      for (let j = i; j < i + win; j++) sum += data[j]! * data[j]!;
      rms.push(Math.sqrt(sum / win));
    }
    const sorted = [...rms].sort((a, b) => a - b);
    const level = (sorted[sorted.length >> 1] ?? 0) * 0.6;
    let first = rms.findIndex((v) => v >= level);
    let last = rms.length - 1 - [...rms].reverse().findIndex((v) => v >= level);
    if (first < 0 || last <= first) {
      first = 0;
      last = rms.length - 1;
    }
    let start = Math.min(first * 0.1, 4);
    let end = (last + 1) * 0.1;
    if (end - start < 8) {
      start = 0;
      end = buffer.duration;
    }
    const loop = { start, end };
    this.loops.set(id, loop);
    return loop;
  }

  /** Dip the music to `to` of its level for `seconds`, then bring it back. */
  duck(to: number, seconds: number, at?: number): void {
    const ctx = this.ctx;
    const node = this.duckNode;
    if (!ctx || !node) return;
    const t = at ?? ctx.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setTargetAtTime(to, t, 0.05);
    node.gain.setTargetAtTime(1, t + seconds, 0.4);
  }

  /** Hold the music low (the pause screen) until `hold(1)`. */
  hold(level: number): void {
    const ctx = this.ctx;
    const node = this.duckNode;
    if (!ctx || !node) return;
    node.gain.cancelScheduledValues(ctx.currentTime);
    node.gain.setTargetAtTime(level, ctx.currentTime, 0.15);
  }
}

