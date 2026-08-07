/**
 * The colour set the whole game draws with.
 *
 * `PALETTE` is a *mutable* object rather than a frozen constant so that a later
 * world can swap its contents in place and every module that already reads
 * `PALETTE.floorA` keeps working. Threading a palette argument through every
 * draw call would be a lot of plumbing for no benefit — exactly one palette is
 * ever active at a time.
 *
 * Two hard rules when picking colours here, both about value rather than hue,
 * because hue alone is not enough of a difference for a five-year-old who is
 * panicking about lane three:
 *
 *  1. **The unicorn is the brightest thing on screen and a kid is the darkest.**
 *     They are the two things the whole game is about, and they must never be
 *     confusable at a glance from across the room.
 *  2. **A refused placement is red AND bright**, never merely dim. It is the
 *     single most important piece of feedback in the game: a child who taps and
 *     sees nothing concludes the game is broken, not that the tap was wrong.
 *
 * Per-toy and per-kid colours are NOT here — they live on the `ToyDef` and
 * `EnemyDef` entries, so adding one is a single registry line rather than an
 * edit in two files. See the authoring contract in DECISIONS.md.
 */
export interface Palette {
  /** The bedroom behind the board. */
  wallTop: string;
  wallBottom: string;
  wainscot: string;
  wainscotLine: string;
  skirting: string;

  /** The floor. Lanes alternate between A and B so five rows read as five. */
  floorA: string;
  floorB: string;
  laneLine: string;
  /** A cell that can take a toy, shown while a card is held. */
  cellFree: string;
  cellFreeEdge: string;
  /** A cell that cannot: occupied, blocked by furniture, or out of reach. */
  cellBusy: string;
  cellDeny: string;

  /** Furniture blocking a cell. Reads as "this is not floor". */
  rug: string;
  rugEdge: string;
  chest: string;
  chestDark: string;

  /** The doorway kids come through. */
  doorFrame: string;
  doorDark: string;
  doorGlow: string;
  doorSill: string;

  /** The cushion the unicorn sits on. */
  cushion: string;
  cushionDark: string;
  cushionFrill: string;

  /** The unicorn. The brightest thing in the room, by rule. */
  unicorn: string;
  unicornShade: string;
  unicornMane: string;
  unicornHorn: string;
  unicornEye: string;
  unicornBlush: string;

  /** Generic kid parts. Clothing colour comes from the EnemyDef. */
  steam: string;
  steamAlpha: number;
  /** The flat tone a kid in the steam is reduced to. Dark, to read against it. */
  fogShape: string;
  water: string;
  waterShine: string;
  waterRim: string;
  /** The attic: the beams, the boarding over them, and the stacked cardboard. */
  joist: string;
  joistShade: string;
  plank: string;
  plankSeam: string;
  box: string;
  boxEdge: string;
  boxTape: string;
  kidSkin: string;
  kidSkinShade: string;
  kidHair: string;
  /** The outline every kid gets, so a pale one still reads dark against the floor. */
  kidOutline: string;
  kidHealthLost: string;
  kidSoaked: string;
  kidSlowed: string;
  kidHidden: string;

  /** Generic toy parts. Body colour comes from the ToyDef. */
  toyShadow: string;
  toyHighlight: string;
  toyDamaged: string;

  /** Projectiles and effects, one per damage kind. */
  shotWater: string;
  shotBubble: string;
  shotPowder: string;
  shotLight: string;
  /** A thrown bath toy. Not a droplet colour — it is an OBJECT in the air. */
  shotThrow: string;
  shotCore: string;

  sparkle: string;
  sparkleCore: string;
  sparkleDim: string;

  /** The tray across the top, and the footer under the board. */
  tray: string;
  /**
   * Text on a light card. The buttons already used `tray` for this; naming it
   * means the next person to put words on a card does not have to go and read
   * `drawButton` to find out which dark colour is the right one.
   */
  cardText: string;
  /** Secondary text on a light card. Still dark — a light grey vanishes. */
  cardTextDim: string;
  trayEdge: string;
  card: string;
  cardEdge: string;
  cardReady: string;
  cardCharging: string;
  cardUnaffordable: string;

  hudText: string;
  hudDim: string;
  hudAccent: string;
  hudWarn: string;
  progressTrack: string;
  progressFill: string;
  /** Full and empty differ in VALUE, not only hue — see the note in hud.ts. */
  heartFull: string;
  heartEmpty: string;

  buttonIdle: string;
  buttonEdge: string;
  buttonActive: string;

  /**
   * Colour laid over the room behind menus. Its own entry rather than reusing a
   * wall tone, because tinting a lit scene with its own pale colour washes it
   * out instead of pushing it back. A scrim always has to be darker than what
   * it covers.
   */
  scrim: string;
  star: string;
  starEmpty: string;
}

export const BEDROOM_PALETTE: Palette = {
  // Dusk in a kid's room: warm lamp light at the top falling to a cooler floor.
  wallTop: '#4a3a6b',
  wallBottom: '#5f4a7d',
  wainscot: '#7b6394',
  wainscotLine: '#8f74aa',
  skirting: '#3c2f57',

  // The two lane tones are 6% apart in value — enough to count the rows,
  // little enough that a kid standing on either is equally legible.
  floorA: '#6b5487',
  floorB: '#755d92',
  laneLine: '#8570a3',
  cellFree: '#b9f0d0',
  cellFreeEdge: '#7ee6a8',
  cellBusy: '#8a7aa3',
  // Bright red, not dark red. See rule 2 above.
  cellDeny: '#ff5470',

  rug: '#3f7fa8',
  rugEdge: '#59a3cf',
  chest: '#a06a44',
  chestDark: '#7a4e30',

  doorFrame: '#8d6a4f',
  doorDark: '#2a1f3d',
  doorGlow: '#ffd9a0',
  doorSill: '#6b4f3a',

  cushion: '#ff9ec7',
  cushionDark: '#d97aa5',
  cushionFrill: '#ffd6e8',

  // Near-white with the faintest pink. Nothing else in the palette comes close
  // to this value, which is the point.
  unicorn: '#fff8fb',
  unicornShade: '#e6d3e2',
  unicornMane: '#a86cff',
  unicornHorn: '#ffd166',
  unicornEye: '#3a2a52',
  unicornBlush: '#ffb3d1',

  steam: '#e8f4fb',
  // Heavy enough to hide a face, light enough to see a shape. Both halves matter.
  // Heavy enough to hide a face, light enough that a shape still shows through.
  // At 0.72 the silhouettes all but vanished and "something is coming" stopped
  // reading, which is the one thing this rule has to keep saying.
  steamAlpha: 0.58,
  fogShape: '#3d3560',
  water: '#5fb6d9',
  joist: '#a37c4e',
  joistShade: '#6f5230',
  plank: '#b98c5c',
  plankSeam: '#8a6740',
  box: '#c9a06a',
  boxEdge: '#8a6136',
  boxTape: '#e8dcc0',
  waterShine: '#d8f4ff',
  waterRim: '#9fe0f5',
  kidSkin: '#f2c396',
  kidSkinShade: '#d6a074',
  kidHair: '#5b3a2e',
  // Every kid is outlined in the darkest colour in the palette. A pale-shirted
  // kid on a pale rug would otherwise vanish exactly when it matters.
  kidOutline: '#1c1430',
  kidHealthLost: '#ff5470',
  kidSoaked: '#79d0f5',
  kidSlowed: '#b7e84f',
  kidHidden: '#6a5c85',

  toyShadow: '#2f2547',
  toyHighlight: '#fffdf5',
  toyDamaged: '#ff8a6b',

  shotWater: '#66c8f2',
  shotBubble: '#dff4ff',
  shotPowder: '#fff0d9',
  shotLight: '#ffe98a',
  shotThrow: '#ff8fc7',
  shotCore: '#ffffff',

  sparkle: '#ffd94d',
  sparkleCore: '#fffbe0',
  sparkleDim: '#c9a72f',

  tray: '#2f2547',
  cardText: '#2f2547',
  cardTextDim: '#5c4a7a',
  trayEdge: '#4a3a6b',
  card: '#f6f0ff',
  cardEdge: '#c9b3e0',
  cardReady: '#7ee6a8',
  cardCharging: '#5a4a78',
  cardUnaffordable: '#9a8bb5',

  hudText: '#fff4fb',
  hudDim: '#b7a3cc',
  hudAccent: '#ffd94d',
  hudWarn: '#ff5470',
  progressTrack: '#3c2f57',
  progressFill: '#ffd94d',
  heartFull: '#ff5470',
  heartEmpty: '#3c2f57',

  buttonIdle: '#fff4fb',
  buttonEdge: '#ff9ec7',
  buttonActive: '#ff4f9c',

  scrim: '#1c1430',
  star: '#ffd94d',
  starEmpty: '#4a3a6b',
};

/** The live palette. */
export const PALETTE: Palette = { ...BEDROOM_PALETTE };

export function applyPalette(next: Palette): void {
  Object.assign(PALETTE, next);
}

/** rgba() helper for the glow, shadow and scrim passes. */
export function alpha(hex: string, a: number): string {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${a})`;
}

/** Blend two palette hexes. Used for damage tinting and charge meters. */
export function mix(from: string, to: string, t: number): string {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const lerp = (shift: number): number =>
    Math.round((((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t));
  return `rgb(${lerp(16)},${lerp(8)},${lerp(0)})`;
}
