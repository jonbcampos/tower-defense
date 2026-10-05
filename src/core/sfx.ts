/**
 * Sound effects and room tone, synthesised sample by sample.
 *
 * The first set (DECISIONS 1) was one oscillator and one noise burst per
 * sound, which is cheap and clear and sounds like a game from 1985. This is
 * the slingshot approach (its DECISIONS 16) applied to a bedroom full of toys:
 *
 *  - **Struck things ring at several frequencies at once** (modal synthesis):
 *    a glockenspiel bar, a woodblock, a cardboard box. The ratios between the
 *    partials are most of what makes one sound like the other.
 *  - **Water is shaped noise**: a squirt is a band of noise sweeping down, a
 *    bubble is a sine whose pitch flicks upwards as it pops (that rising
 *    "bloop" is what a real bubble does), a drip is the same thing smaller.
 *  - **Each toy has its own voice**, so a child can hear which toy is busy
 *    without finding it: the wand blows, the machine whirrs and burbles, the
 *    sprinkler ticks, the water gun psshts, the slushie clinks with ice, the
 *    beach ball boings, the lobber creaks and whooshes.
 *
 * The rule from the original file still holds and is the thing to keep:
 * **going well is bright and rising; going wrong is low and falling.** And
 * `deny` is load-bearing: it is the only buzz in the game, low and dry, two
 * falling pulses, nothing like any success sound (see audio.ts).
 *
 * Every function returns raw mono samples for a sample rate and is pure apart
 * from `Math.random`, so a script can render them to a WAV outside the browser
 * for a person to listen to.
 */

export type SfxKind =
  | 'select'
  | 'place'
  | 'deny'
  | 'refund'
  | 'sweep'
  | 'collect'
  | 'shoot-wand'
  | 'shoot-machine'
  | 'shoot-sprinkler'
  | 'shoot-watergun'
  | 'shoot-slushie'
  | 'shoot-beachball'
  | 'shoot-lobber'
  | 'hit'
  | 'shrug'
  | 'shield'
  | 'down'
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
  | 'throw'
  | 'win'
  | 'lose';

export const SFX_KINDS: readonly SfxKind[] = [
  'select', 'place', 'deny', 'refund', 'sweep', 'collect',
  'shoot-wand', 'shoot-machine', 'shoot-sprinkler', 'shoot-watergun', 'shoot-slushie',
  'shoot-beachball', 'shoot-lobber',
  'hit', 'shrug', 'shield', 'down', 'toy-lost', 'wave', 'big-wave', 'light', 'powder',
  'sweeper', 'boost', 'squeak', 'magnet', 'thud', 'squeeze', 'throw', 'win', 'lose',
];

/** Room tone per world. Same ids as `WorldId`, repeated so core doesn't import game. */
export type AmbienceKind = 'bedroom' | 'backyard' | 'bathroom' | 'attic';

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

// Note frequencies used by the chimes, so the tunes are readable.
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const D6 = 1174.66;
const E6 = 1318.51;
const G6 = 1567.98;
const A6 = 1760;
const C7 = 2093;
const E7 = 2637;

export function synth(kind: SfxKind, sr: number): Float32Array {
  switch (kind) {
    case 'select': return select(sr);
    case 'place': return place(sr);
    case 'deny': return deny(sr);
    case 'refund': return refund(sr);
    case 'sweep': return sweep(sr);
    case 'collect': return collect(sr);
    case 'shoot-wand': return wand(sr);
    case 'shoot-machine': return machine(sr);
    case 'shoot-sprinkler': return sprinkler(sr);
    case 'shoot-watergun': return waterGun(sr);
    case 'shoot-slushie': return slushie(sr);
    case 'shoot-beachball': return beachBall(sr);
    case 'shoot-lobber': return lobber(sr);
    case 'hit': return hit(sr);
    case 'shrug': return shrug(sr);
    case 'shield': return cardboard(sr, 1);
    case 'down': return down(sr);
    case 'toy-lost': return toyLost(sr);
    case 'wave': return horn(sr, false);
    case 'big-wave': return horn(sr, true);
    case 'light': return shimmer(sr);
    case 'powder': return poof(sr);
    case 'sweeper': return bearHug(sr);
    case 'boost': return boost(sr);
    case 'squeak': return squeakToy(sr);
    case 'magnet': return magnet(sr);
    case 'thud': return cardboard(sr, 0.5);
    case 'squeeze': return squeeze(sr);
    case 'throw': return whoosh(sr, 0.4, 500, 2400, 900);
    case 'win': return win(sr);
    case 'lose': return lose(sr);
  }
}

// --- Building blocks -------------------------------------------------------------

function buffer(sr: number, seconds: number): Float32Array {
  return new Float32Array(Math.max(1, Math.floor(sr * seconds)));
}

/** Scale so the loudest sample is `peak`. Every effect lands at the same level; audio.ts sets the mix. */
function normalise(out: Float32Array, peak = 0.9): Float32Array {
  let max = 1e-6;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]!));
  const k = peak / max;
  for (let i = 0; i < out.length; i++) out[i] = out[i]! * k;
  return out;
}

/** A one-pole low-pass, in place. `cutoff` may be a function of time. */
function lowpass(x: Float32Array, sr: number, cutoff: number | ((t: number) => number)): Float32Array {
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    const fc = typeof cutoff === 'number' ? cutoff : cutoff(i / sr);
    const a = 1 - Math.exp((-TAU * fc) / sr);
    y += (x[i]! - y) * a;
    x[i] = y;
  }
  return x;
}

type Wave = 'sine' | 'tri' | 'soft' | 'buzz' | 'reed';

function osc(wave: Wave, phase: number): number {
  const p = phase - Math.floor(phase);
  switch (wave) {
    case 'sine':
      return Math.sin(TAU * p);
    case 'tri':
      return 1 - 4 * Math.abs(p - 0.5);
    case 'soft':
      // A sine driven into a soft clip: rounder than a square, rubbery.
      return Math.tanh(Math.sin(TAU * p) * 2.2) / Math.tanh(2.2);
    case 'buzz':
      // A band-limited-ish square (first four odd harmonics): the deny voice.
      return (
        Math.sin(TAU * p) + Math.sin(3 * TAU * p) / 3 + Math.sin(5 * TAU * p) / 5 + Math.sin(7 * TAU * p) / 7
      );
    case 'reed': {
      // A soft sawtooth (eight harmonics): toy horns and the bear's hum.
      let s = 0;
      for (let k = 1; k <= 8; k++) s += Math.sin(k * TAU * p) / k;
      return s * 0.6;
    }
  }
}

interface ToneOpts {
  wave?: Wave;
  attack?: number;
  /** Exponential decay rate, 1/s. 0 holds the note until the release. */
  decay?: number;
  release?: number;
  vibratoHz?: number;
  vibratoDepth?: number;
}

/** Add a note gliding exponentially from `f0` to `f1` over `dur`, starting at `at` seconds. */
function tone(out: Float32Array, sr: number, at: number, dur: number, f0: number, f1: number, amp: number, o: ToneOpts = {}): void {
  const wave = o.wave ?? 'sine';
  const attack = o.attack ?? 0.004;
  const decay = o.decay ?? 6;
  const release = Math.min(o.release ?? 0.02, dur / 2);
  const start = Math.floor(at * sr);
  const n = Math.floor(dur * sr);
  let phase = Math.random();
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / sr;
    let f = f0 * Math.pow(f1 / f0, t / dur);
    if (o.vibratoHz) f *= 1 + (o.vibratoDepth ?? 0.02) * Math.sin(TAU * o.vibratoHz * t);
    phase += f / sr;
    const env = Math.min(1, t / attack) * Math.exp(-decay * t) * Math.min(1, (dur - t) / release);
    out[start + i] = out[start + i]! + osc(wave, phase) * env * amp;
  }
}

/**
 * Add noise through a resonant band-pass (a state-variable filter) whose
 * centre glides from `f0` to `f1`. `shape` is the amplitude envelope over 0..1.
 */
function noise(
  out: Float32Array,
  sr: number,
  at: number,
  dur: number,
  f0: number,
  f1: number,
  amp: number,
  q = 1.2,
  shape: (u: number) => number = (u) => Math.exp(-u * 5) * Math.min(1, u * 60),
  mode: 'band' | 'low' | 'high' = 'band',
): void {
  const start = Math.floor(at * sr);
  const n = Math.floor(dur * sr);
  let low = 0;
  let band = 0;
  const damp = 1 / q;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const u = i / n;
    const fc = Math.min(sr / 6, f0 * Math.pow(f1 / f0, u));
    const f = 2 * Math.sin((Math.PI * fc) / sr);
    const x = Math.random() * 2 - 1;
    low += f * band;
    const high = x - low - damp * band;
    band += f * high;
    const y = mode === 'band' ? band : mode === 'low' ? low : high;
    out[start + i] = out[start + i]! + y * shape(u) * amp;
  }
}

/**
 * A struck object: several damped partials plus a little filtered click.
 * Glockenspiel bars are roughly 1 : 2.76 : 5.40 : 8.93; a woodblock is two
 * close, fast partials; cardboard is low and choked.
 */
function strike(
  out: Float32Array,
  sr: number,
  at: number,
  f: number,
  amp: number,
  ratios: readonly number[],
  decays: readonly number[],
  click = 0.15,
): void {
  const start = Math.floor(at * sr);
  const longest = Math.min(...decays);
  const n = Math.min(out.length - start, Math.floor((sr * 6) / longest));
  const amps = ratios.map((_, k) => rnd(0.7, 1) / (k + 1));
  const phases = ratios.map(() => rnd(0, TAU));
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    for (let k = 0; k < ratios.length; k++) {
      s += amps[k]! * Math.exp(-decays[k]! * t) * Math.sin(TAU * f * ratios[k]! * t + phases[k]!);
    }
    lp += ((Math.random() * 2 - 1) * Math.exp(-t * 300) - lp) * 0.5;
    out[start + i] = out[start + i]! + (s + lp * click * 4) * amp * Math.min(1, t * sr / 8);
  }
}

const GLOCK = [1, 2.76, 5.4, 8.93] as const;
const GLOCK_DECAY = [7, 14, 26, 40] as const;

function glock(out: Float32Array, sr: number, at: number, f: number, amp: number): void {
  strike(out, sr, at, f, amp, GLOCK, GLOCK_DECAY, 0.08);
}

/** A bubble: a sine whose pitch flicks UP as it decays (that's what a real one does). */
function bloop(out: Float32Array, sr: number, at: number, f: number, dur: number, amp: number, rise = 2.2): void {
  tone(out, sr, at, dur, f, f * rise, amp, { decay: 4 / dur, attack: 0.002 });
}

/** A few tiny high sparkles scattered after `at`. */
function sparkles(out: Float32Array, sr: number, at: number, spread: number, count: number, amp: number): void {
  for (let k = 0; k < count; k++) {
    const f = rnd(3500, 7500);
    tone(out, sr, at + rnd(0, spread), 0.08, f, f * 1.02, amp * rnd(0.4, 1), { decay: 45 });
  }
}

// --- Interface ---------------------------------------------------------------------

/** Picking up a card: a tiny woodblock tok. Happens constantly, so it's small. */
function select(sr: number): Float32Array {
  const out = buffer(sr, 0.12);
  strike(out, sr, 0, rnd(880, 940), 1, [1, 2.57], [55, 80], 0.3);
  return normalise(out, 0.7);
}

/** Something landed and it worked: a soft cushioned thump, then two rising chimes. */
function place(sr: number): Float32Array {
  const out = buffer(sr, 0.6);
  tone(out, sr, 0, 0.16, 150, 70, 0.9, { decay: 22, wave: 'soft' });
  noise(out, sr, 0, 0.08, 500, 300, 0.9, 0.8, (u) => Math.exp(-u * 6) * Math.min(1, u * 40), 'low');
  glock(out, sr, 0.03, E6, 0.35);
  glock(out, sr, 0.09, A6, 0.4);
  return normalise(out);
}

/**
 * Not there. The one buzz in the game: two short, low, dry pulses, the second
 * lower ("uh-uh"). No chime, no reverb, nothing rising, so it can't be heard as
 * a success; soft-edged, because it fires on an honest mistake.
 */
function deny(sr: number): Float32Array {
  const out = buffer(sr, 0.3);
  tone(out, sr, 0, 0.1, 215, 195, 1, { wave: 'buzz', decay: 4, attack: 0.006, release: 0.025 });
  tone(out, sr, 0.13, 0.15, 170, 138, 1, { wave: 'buzz', decay: 5, attack: 0.006, release: 0.04 });
  lowpass(out, sr, 1600);
  return normalise(out, 0.9);
}

/** A toy back in the box: a soft whisk and two coins clinking DOWN a step. */
function refund(sr: number): Float32Array {
  const out = buffer(sr, 0.45);
  noise(out, sr, 0, 0.12, 2500, 1200, 0.25, 1, (u) => Math.sin(Math.PI * u));
  glock(out, sr, 0.02, G6, 0.4);
  glock(out, sr, 0.1, E6, 0.35);
  return normalise(out, 0.8);
}

/** A brush across the floor: two airy strokes, no tone (DECISIONS 54: neutral). */
function sweep(sr: number): Float32Array {
  const out = buffer(sr, 0.32);
  const grain = (u: number): number => Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.random());
  noise(out, sr, 0, 0.13, 3200, 2000, 1, 1.5, grain);
  noise(out, sr, 0.14, 0.16, 2600, 1500, 0.8, 1.5, grain);
  return normalise(out, 0.6);
}

/** The commonest happy sound: two quick glockenspiel notes going up, and a glint. */
function collect(sr: number): Float32Array {
  const out = buffer(sr, 0.5);
  glock(out, sr, 0, rnd(0.99, 1.01) * A6, 0.7);
  glock(out, sr, 0.05, E7, 0.6);
  sparkles(out, sr, 0.06, 0.15, 4, 0.12);
  return normalise(out, 0.85);
}

// --- Toy voices --------------------------------------------------------------------

/** Bubble Wand: a little puff of breath, and a bubble. */
function wand(sr: number): Float32Array {
  const out = buffer(sr, 0.2);
  noise(out, sr, 0, 0.07, 1400, 900, 0.25, 0.9, (u) => Math.sin(Math.PI * u));
  bloop(out, sr, 0.03, rnd(480, 560), 0.07, 0.8);
  return normalise(out, 0.8);
}

/** Bubble Machine: a whirr and a burble of three bubbles. */
function machine(sr: number): Float32Array {
  const out = buffer(sr, 0.3);
  const whirr = (u: number): number => Math.sin(Math.PI * u) * (0.5 + 0.5 * Math.sin(u * 0.12 * 2 * Math.PI * 70));
  noise(out, sr, 0, 0.12, 500, 700, 0.35, 3, whirr);
  bloop(out, sr, 0.03, rnd(420, 480), 0.06, 0.7);
  bloop(out, sr, 0.08, rnd(580, 640), 0.06, 0.6);
  bloop(out, sr, 0.13, rnd(500, 540), 0.07, 0.6);
  return normalise(out, 0.8);
}

/** Sprinkler: tsk-tsk-tsk, three spurts as it swings. */
function sprinkler(sr: number): Float32Array {
  const out = buffer(sr, 0.25);
  for (let k = 0; k < 3; k++) {
    strike(out, sr, k * 0.065, 2400, 0.12, [1, 1.6], [200, 260], 0.5);
    noise(out, sr, k * 0.065, 0.05, 5500, 4200, 0.6, 1.4, (u) => Math.exp(-u * 4) * Math.min(1, u * 30));
  }
  return normalise(out, 0.7);
}

/** Water Gun: a pump click, then a jet of water that drops in pitch. */
function waterGun(sr: number): Float32Array {
  const out = buffer(sr, 0.28);
  strike(out, sr, 0, 1300, 0.25, [1, 2.3], [120, 160], 0.6);
  noise(out, sr, 0.01, 0.22, 3200, 1100, 1, 1.6, (u) => Math.min(1, u * 25) * Math.exp(-u * 3.5));
  return normalise(out, 0.85);
}

/** Slushie Cup: a shorter squirt with ice clinking in it. */
function slushie(sr: number): Float32Array {
  const out = buffer(sr, 0.32);
  noise(out, sr, 0, 0.14, 2600, 1300, 0.7, 1.4, (u) => Math.min(1, u * 25) * Math.exp(-u * 4));
  for (let k = 0; k < 3; k++) {
    strike(out, sr, 0.02 + k * 0.045 + rnd(0, 0.02), rnd(3200, 4800), 0.25, [1, 2.32, 4.25], [30, 40, 55], 0.05);
  }
  return normalise(out, 0.8);
}

/** Beach Ball: a rubbery slap and a boing. */
function beachBall(sr: number): Float32Array {
  const out = buffer(sr, 0.4);
  noise(out, sr, 0, 0.03, 900, 600, 0.6, 1, (u) => Math.exp(-u * 4));
  tone(out, sr, 0, 0.35, 170, 300, 0.9, { wave: 'soft', decay: 8, vibratoHz: 16, vibratoDepth: 0.06 });
  return normalise(out, 0.85);
}

/** Bath Toy Lobber: a wooden creak-and-release, then the toy whooshing up. */
function lobber(sr: number): Float32Array {
  const out = buffer(sr, 0.45);
  strike(out, sr, 0, 260, 0.6, [1, 2.4, 3.9], [40, 60, 90], 0.4);
  tone(out, sr, 0.01, 0.07, 120, 90, 0.4, { wave: 'soft', decay: 30 });
  noise(out, sr, 0.04, 0.35, 500, 2200, 0.6, 2.2, (u) => Math.sin(Math.PI * u));
  return normalise(out, 0.8);
}

// --- Kids ------------------------------------------------------------------------

/** A shot landing: a small splash with a bubble in it. Quiet; it happens a lot. */
function hit(sr: number): Float32Array {
  const out = buffer(sr, 0.14);
  noise(out, sr, 0, 0.06, 2200, 900, 0.6, 1.2);
  bloop(out, sr, 0.005, rnd(800, 1000), 0.05, 0.5, 1.6);
  return normalise(out, 0.6);
}

/** Water off a raincoat: a damp, dead tap. Says "that did nothing". */
function shrug(sr: number): Float32Array {
  const out = buffer(sr, 0.16);
  tone(out, sr, 0, 0.1, 240, 180, 0.8, { decay: 30 });
  noise(out, sr, 0, 0.05, 600, 400, 0.5, 0.9, (u) => Math.exp(-u * 5), 'low');
  return normalise(out, 0.6);
}

/** A cardboard box: a low, choked knock and a papery scuff. `size` 1 is the Wagon's shield. */
function cardboard(sr: number, size: number): Float32Array {
  const out = buffer(sr, 0.25 + 0.15 * size);
  strike(out, sr, 0, 150 / Math.sqrt(size), 1, [1, 1.72, 2.9], [35, 50, 70], 0.6);
  noise(out, sr, 0, 0.1 + 0.1 * size, 900, 400, 0.5, 0.8, (u) => Math.exp(-u * 5), 'low');
  return normalise(out, 0.8);
}

/**
 * A kid turned happy and wandering off: two glockenspiel notes up and a
 * slide-whistle "wheee". A reward sound, never an impact: nobody is beaten.
 */
function down(sr: number): Float32Array {
  const out = buffer(sr, 0.7);
  glock(out, sr, 0, C6, 0.6);
  glock(out, sr, 0.08, G6, 0.6);
  tone(out, sr, 0.05, 0.3, 700, 1500, 0.22, { decay: 4, attack: 0.04, vibratoHz: 7, vibratoDepth: 0.02 });
  sparkles(out, sr, 0.1, 0.25, 3, 0.1);
  return normalise(out, 0.85);
}

/** A toy pulled away: a plush flump and a slide whistle going DOWN. Low and falling. */
function toyLost(sr: number): Float32Array {
  const out = buffer(sr, 0.7);
  tone(out, sr, 0, 0.18, 120, 60, 0.9, { wave: 'soft', decay: 18 });
  noise(out, sr, 0, 0.12, 400, 200, 0.8, 0.8, (u) => Math.exp(-u * 5), 'low');
  tone(out, sr, 0.08, 0.55, 760, 260, 0.35, { decay: 2.5, attack: 0.03, vibratoHz: 6, vibratoDepth: 0.03 });
  return normalise(out, 0.9);
}

/**
 * A kid reached the unicorn and hugged her: a plush squish and a squeak that
 * sinks. Going wrong, so falling; but a hug, so soft.
 */
function squeeze(sr: number): Float32Array {
  const out = buffer(sr, 0.7);
  const squish = (u: number): number => Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.sin(u * 40));
  noise(out, sr, 0, 0.3, 700, 300, 1, 1, squish, 'low');
  tone(out, sr, 0.05, 0.2, 1000, 760, 0.35, { wave: 'soft', decay: 4, vibratoHz: 28, vibratoDepth: 0.03 });
  tone(out, sr, 0.25, 0.4, 420, 200, 0.5, { wave: 'tri', decay: 3, attack: 0.03 });
  return normalise(out, 0.85);
}

// --- Waves and specials ------------------------------------------------------------

/**
 * The wave horn: a toy trumpet going toot-TOOT, up a fourth. The big wave is
 * a snare roll and three notes climbing, the only sound that takes its time.
 */
function horn(sr: number, big: boolean): Float32Array {
  const out = buffer(sr, big ? 1.5 : 0.6);
  const note = (at: number, f: number, dur: number, amp: number): void =>
    tone(out, sr, at, dur, f, f, amp, { wave: 'reed', attack: 0.02, decay: 1.5, release: 0.05, vibratoHz: 5.5, vibratoDepth: 0.008 });
  if (big) {
    // A snare roll: noise taps that speed up.
    let t = 0;
    let gap = 0.07;
    while (t < 0.55) {
      noise(out, sr, t, 0.06, 2500, 1800, 0.25 + t * 0.6, 0.7, (u) => Math.exp(-u * 6));
      t += gap;
      gap = Math.max(0.03, gap * 0.9);
    }
    note(0.55, C5, 0.18, 0.7);
    note(0.75, E5, 0.18, 0.7);
    note(0.95, G5, 0.5, 0.8);
    glock(out, sr, 0.95, C7, 0.3);
  } else {
    note(0, G5 * 0.75, 0.14, 0.6);
    note(0.17, C5 * 1.0, 0.3, 0.7);
  }
  lowpass(out, sr, 3500);
  return normalise(out, 0.85);
}

/** Nightlight: a bright rising shimmer over a soft swell. It should feel like relief. */
function shimmer(sr: number): Float32Array {
  const out = buffer(sr, 1.2);
  const notes = [C6, D6, E6, G6, A6, C7, E7];
  notes.forEach((f, k) => glock(out, sr, k * 0.06, f, 0.35));
  for (const f of [C5 * 2, E5 * 2, G5 * 2]) {
    tone(out, sr, 0, 1.1, f, f, 0.12, { attack: 0.25, decay: 1.5, release: 0.3 });
  }
  return normalise(out, 0.85);
}

/** Powder Puff: a soft poof that closes down, and a few glints in the cloud. */
function poof(sr: number): Float32Array {
  const out = buffer(sr, 0.6);
  noise(out, sr, 0, 0.45, 3000, 350, 1, 0.7, (u) => Math.min(1, u * 30) * Math.exp(-u * 4), 'low');
  sparkles(out, sr, 0.1, 0.35, 5, 0.12);
  return normalise(out, 0.85);
}

/**
 * The Guard Bear scooping a kid up: a warm "mm-HMM" bear hum, a whoosh, and
 * a rising chime. Loud on purpose: it's a rescue.
 */
function bearHug(sr: number): Float32Array {
  const out = buffer(sr, 1.0);
  const hum = buffer(sr, 0.6);
  tone(hum, sr, 0, 0.22, 110, 120, 1, { wave: 'reed', attack: 0.03, decay: 1, release: 0.04 });
  tone(hum, sr, 0.24, 0.32, 140, 125, 1, { wave: 'reed', attack: 0.03, decay: 1, release: 0.08 });
  lowpass(hum, sr, 700);
  for (let i = 0; i < hum.length; i++) out[i] = hum[i]!;
  noise(out, sr, 0.1, 0.4, 400, 1600, 0.6, 1.8, (u) => Math.sin(Math.PI * u));
  glock(out, sr, 0.5, C6, 0.35);
  glock(out, sr, 0.58, E6, 0.35);
  glock(out, sr, 0.66, G6, 0.4);
  return normalise(out, 0.95);
}

/** A shot through the bubble bath comes out big: the wand's bubble, deeper, with fizz. */
function boost(sr: number): Float32Array {
  const out = buffer(sr, 0.25);
  noise(out, sr, 0, 0.18, 4000, 3000, 0.25, 1, (u) => Math.exp(-u * 4) * (0.5 + Math.random() * 0.5));
  bloop(out, sr, 0, rnd(260, 300), 0.12, 0.9, 2.4);
  return normalise(out, 0.75);
}

/**
 * Squeaky Toy: a real rubber squeak is a pitch that jumps up with a fast
 * flutter on it, plus the air through the hole. Up, then down.
 */
function squeakToy(sr: number): Float32Array {
  const out = buffer(sr, 0.32);
  tone(out, sr, 0, 0.1, 950, 1500, 0.8, { wave: 'soft', decay: 3, attack: 0.008, vibratoHz: 38, vibratoDepth: 0.04 });
  tone(out, sr, 0.12, 0.15, 1450, 950, 0.8, { wave: 'soft', decay: 3, attack: 0.008, vibratoHz: 34, vibratoDepth: 0.04 });
  noise(out, sr, 0, 0.27, 2500, 2000, 0.15, 2, (u) => Math.sin(Math.PI * u));
  lowpass(out, sr, 5000);
  return normalise(out, 0.8);
}

/** Magnet Wand: a metallic zing (FM, rising) over a short rasp. Something TAKEN, not broken. */
function magnet(sr: number): Float32Array {
  const out = buffer(sr, 0.4);
  let pc = 0;
  let pm = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const fc = 600 * Math.pow(2.2, Math.min(1, t / 0.15));
    pc += fc / sr;
    pm += (fc * 1.41) / sr;
    const index = 3 * Math.exp(-t * 8);
    out[i] = Math.sin(TAU * pc + index * Math.sin(TAU * pm)) * Math.min(1, t * 400) * Math.exp(-t * 7) * 0.7;
  }
  noise(out, sr, 0, 0.1, 3500, 1500, 0.4, 2, (u) => Math.exp(-u * 4));
  return normalise(out, 0.8);
}

/** Air moving: band-passed noise sweeping up then down, swelling in the middle. */
function whoosh(sr: number, dur: number, f0: number, fMid: number, f1: number): Float32Array {
  const out = buffer(sr, dur);
  const half = dur / 2;
  noise(out, sr, 0, half, f0, fMid, 1, 2, (u) => Math.pow(u, 1.5));
  noise(out, sr, half, half, fMid, f1, 1, 2, (u) => Math.pow(1 - u, 1.5));
  return normalise(out, 0.7);
}

// --- Endings -------------------------------------------------------------------------

/** All four up, then a ringing chord and sparkle. The fallback when the Lyria sting is missing. */
function win(sr: number): Float32Array {
  const out = buffer(sr, 1.6);
  [C6, E6, G6, C7].forEach((f, k) => glock(out, sr, k * 0.11, f, 0.55));
  for (const f of [C5, E5, G5]) tone(out, sr, 0.44, 1.1, f, f, 0.18, { wave: 'reed', attack: 0.02, decay: 2, release: 0.3 });
  sparkles(out, sr, 0.45, 0.6, 8, 0.12);
  lowpass(out, sr, 7000);
  return normalise(out, 0.9);
}

/**
 * A gentle, funny "wah-wah-wah-waaah": a muted toy horn stepping down. Low and
 * falling, but warm: "try again", not "you failed".
 */
function lose(sr: number): Float32Array {
  const out = buffer(sr, 1.8);
  const steps = [392, 370, 349, 330];
  steps.forEach((f, k) => {
    const last = k === steps.length - 1;
    tone(out, sr, k * 0.32, last ? 0.9 : 0.28, f / 2, (last ? f * 0.94 : f) / 2, 0.7, {
      wave: 'reed',
      attack: 0.03,
      decay: last ? 1.4 : 2,
      release: last ? 0.3 : 0.05,
      vibratoHz: last ? 6 : 0,
      vibratoDepth: 0.025,
    });
  });
  // The "wah": a low-pass that opens and closes on each note, like a mute.
  lowpass(out, sr, (t) => 500 + 900 * Math.pow(Math.sin(Math.PI * ((t % 0.32) / 0.32)), 2));
  return normalise(out, 0.85);
}

// --- Room tone ------------------------------------------------------------------------

/**
 * A soft, seamless loop of room tone for a world. Very quiet in the mix: it is
 * there so the room is a place and silence never reads as "broken".
 *
 *  - bedroom: a low hush and a slow clock.
 *  - backyard: a breeze that comes and goes, and birds.
 *  - bathroom: a hollow tiled hush, water lapping, and drips.
 *  - attic: wind under the roof and the odd creak of a beam.
 */
export function ambience(kind: AmbienceKind, sr: number): Float32Array {
  const seconds = 12;
  const tail = 1.5;
  const out = buffer(sr, seconds + tail);
  const total = seconds + tail;
  switch (kind) {
    case 'bedroom': {
      noise(out, sr, 0, total, 220, 220, 0.25, 0.7, () => 1, 'low');
      for (let t = 0.2; t < total; t += 1) {
        strike(out, sr, t, t % 2 < 1 ? 2300 : 1900, 0.05, [1, 1.9], [120, 160], 0.3);
      }
      break;
    }
    case 'backyard': {
      noise(out, sr, 0, total, 700, 700, 0.35, 0.6, (u) => 0.5 + 0.5 * Math.sin(TAU * u * 2 + 1), 'low');
      for (let k = 0; k < 5; k++) {
        const at = rnd(0.5, seconds - 1);
        const base = rnd(2600, 4200);
        const chirps = 2 + Math.floor(Math.random() * 3);
        for (let c = 0; c < chirps; c++) {
          tone(out, sr, at + c * 0.11, 0.07, base * 1.3, base * 0.85, 0.06, { decay: 10, attack: 0.005 });
        }
      }
      break;
    }
    case 'bathroom': {
      noise(out, sr, 0, total, 350, 350, 0.2, 2, () => 1);
      noise(out, sr, 0, total, 500, 500, 0.12, 0.7, (u) => 0.5 + 0.5 * Math.sin(TAU * u * 6), 'low');
      for (let k = 0; k < 5; k++) bloop(out, sr, rnd(0.3, seconds - 0.5), rnd(900, 1400), 0.06, 0.08, 1.8);
      break;
    }
    case 'attic': {
      noise(out, sr, 0, total, 350, 650, 0.5, 4, (u) => 0.35 + 0.65 * Math.pow(Math.sin(Math.PI * u * 3), 2));
      for (let k = 0; k < 2; k++) {
        // A creak: a slow stick-slip pulse train ringing a beam.
        const at = rnd(1, seconds - 2);
        const len = rnd(0.4, 0.7);
        const creak = buffer(sr, len);
        let next = 0;
        for (let i = 0; i < creak.length; i++) {
          const t = i / sr;
          if (t >= next) {
            next = t + 1 / (35 + 30 * Math.sin(Math.PI * (t / len)));
            strike(creak, sr, t, 420, 0.04, [1, 2.3], [90, 140], 0);
          }
        }
        const s = Math.floor(at * sr);
        for (let i = 0; i < creak.length && s + i < out.length; i++) out[s + i] = out[s + i]! + creak[i]! * Math.sin(Math.PI * (i / creak.length));
      }
      break;
    }
  }
  // Fold the tail over the head, so the loop has no seam.
  const n = Math.floor(seconds * sr);
  const x = out.length - n;
  for (let i = 0; i < x; i++) {
    const k = i / x;
    out[i] = out[i]! * k + out[n + i]! * (1 - k);
  }
  return normalise(out.slice(0, n), 0.8);
}
