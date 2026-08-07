import { Audio } from './core/audio';
import { Input, type KeyAction, type Tap } from './core/input';
import { startLoop } from './core/loop';
import { Rng } from './core/rng';
import { Viewport } from './core/viewport';
import { WakeLock } from './core/wakelock';
import {
  freshSave,
  loadSave,
  recordEndless,
  recordResult,
  writeSave,
  type Save,
} from './core/save';
import { DIFFICULTIES, cellAt, loadoutSlotsFor, type DifficultyId } from './game/config';
import { LEVELS, levelById, unlockedBy, type WorldId } from './game/levels';
import { buildEndless, endlessKit, ENDLESS_ID, type EndlessRun } from './game/endless';
import { GameState, validateDesignContracts, type GameEvent } from './game/state';
import { TOYS, type ToyId } from './game/toys';
import { Particles } from './render/particles';
import { loadSprites, sprite, spriteFrames } from './render/sprites';
import {
  advanceScene,
  sceneRenderer,
  setGuideDisplay,
  setSelectWorld,
  setEndlessScore,
  setLoadoutDisplay,
  setSaveForDisplay,
  setUnlockBanner,
} from './render/scene';
import { addPopup, hitTestPause, resetHud, updateHud, validateHudContracts } from './ui/hud';
import {
  guideButton,
  guideMenu,
  guidePages,
  hitTestMenu,
  levelMenu,
  loadoutMenu,
  muteButton,
  pauseMenu,
  resultMenu,
  setMutedDisplay,
  titleMenu,
  type GuideTab,
} from './ui/screens';
import { hitTestBroom, hitTestCard, validateTrayContracts } from './ui/tray';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('#game canvas missing');

const viewport = new Viewport(canvas);
const input = new Input(viewport);
const state = new GameState();
const particles = new Particles();
const audio = new Audio();
const wakeLock = new WakeLock();

// Generated art, if any has been generated. Fire-and-forget: nothing waits for
// it, nothing breaks without it, and every piece that arrives simply replaces
// the hand-drawn version of that one thing. See scripts/generate-art.mjs.
loadSprites(import.meta.env.BASE_URL);

/**
 * Surface any broken design contract loudly, on every load.
 *
 * These are the fairness guarantees the whole game is tuned around, and they
 * break silently otherwise — a levelling change that makes HARD unwinnable
 * looks exactly like a levelling change that doesn't.
 */
for (const problem of [
  ...validateDesignContracts(),
  ...validateTrayContracts(),
  ...validateHudContracts(),
]) {
  console.error(`[design] ${problem}`);
}

let save: Save = freshSave();
const load = loadSave();
save = load.save;
if (load.outcome === 'corrupt') console.warn('[save] unreadable save discarded');
if (load.outcome === 'future') console.warn('[save] newer save parked, starting fresh');
setSaveForDisplay(save);

audio.muted = save.muted;
setMutedDisplay(audio.muted);

/** The level the player is setting up or replaying. */
let currentLevelId = 1;
/** Cards chosen on the loadout screen. Unused on EASY. */
let picked: ToyId[] = [];
/** The endless run in progress, if any. Null during the campaign. */
let endless: EndlessRun | null = null;
/** Which world's levels the picker is showing. */
let selectWorld: WorldId = 'bedroom';
/** Where the guide is open, if it is. Reset every time it opens. */
let guideTab: GuideTab = 'toys';
let guidePage = 0;
let squeezedThisStep = false;

// --- Menus ------------------------------------------------------------------

/**
 * Menus are polled here rather than inside the simulation.
 *
 * `GameState.update()` early-returns unless the phase is 'playing', so it stays
 * purely about the run itself and the trial harness can drive a level without
 * ever going near a button.
 */
function routeMenuTap(tap: Tap): void {
  if (state.phase === 'title') {
    if (hitTestMenu([muteButton()], tap.x, tap.y)) {
      toggleMute();
      return;
    }
    if (hitTestMenu([guideButton()], tap.x, tap.y)) {
      audio.play('select');
      guideTab = 'toys';
      guidePage = 0;
      setGuideDisplay(guideTab, guidePage);
      state.phase = 'guide';
      return;
    }
    const hit = hitTestMenu(titleMenu(), tap.x, tap.y);
    if (!hit) return;
    audio.play('select');
    save.difficulty = hit.id.slice('diff:'.length) as DifficultyId;
    writeSave(save);
    // Open on the world she has reached, not always on the first one. Making a
    // child page forward to where she left off every single time is the kind of
    // small tax that turns into "I don't want to play it".
    selectWorld = levelById(Math.min(save.unlocked, LEVELS.length)).world;
    setSelectWorld(selectWorld);
    state.phase = 'select';
    return;
  }

  if (state.phase === 'guide') {
    const hit = hitTestMenu(guideMenu(guideTab, guidePage), tap.x, tap.y);
    if (!hit) return;
    audio.play('select');
    if (hit.id === 'back') {
      state.phase = 'title';
      return;
    }
    if (hit.id.startsWith('tab:')) {
      guideTab = hit.id.slice('tab:'.length) as GuideTab;
      // Back to the first page on a tab change: keeping page 2 when the other
      // list is shorter would open on a page that isn't there.
      guidePage = 0;
    } else if (hit.id === 'prev') {
      guidePage = Math.max(0, guidePage - 1);
    } else if (hit.id === 'next') {
      guidePage = Math.min(guidePages(guideTab) - 1, guidePage + 1);
    }
    setGuideDisplay(guideTab, guidePage);
    return;
  }

  if (state.phase === 'select') {
    const hit = hitTestMenu(levelMenu(save, selectWorld), tap.x, tap.y);
    if (!hit) return;
    audio.play('select');
    if (hit.id === 'back') {
      state.phase = 'title';
      return;
    }
    if (hit.id.startsWith('world:')) {
      selectWorld = hit.id.slice('world:'.length) as WorldId;
      setSelectWorld(selectWorld);
      return;
    }
    if (hit.id === 'endless') {
      beginEndless();
      return;
    }
    currentLevelId = Number(hit.id.slice('level:'.length));
    beginSetup();
    return;
  }

  if (state.phase === 'loadout') {
    const available = availableToys();
    const hit = hitTestMenu(loadoutMenu(available), tap.x, tap.y);
    if (!hit) return;
    if (hit.id === 'back') {
      audio.play('select');
      state.phase = 'select';
      return;
    }
    if (hit.id === 'play') {
      if (picked.length === 0) {
        audio.play('deny');
        return;
      }
      audio.play('select');
      startRun(picked);
      return;
    }
    const id = hit.id.slice('toy:'.length) as ToyId;
    const at = picked.indexOf(id);
    if (at >= 0) {
      picked.splice(at, 1);
      audio.play('refund');
    } else if (picked.length < maxLoadout()) {
      picked.push(id);
      audio.play('select');
    } else {
      audio.play('deny');
    }
    setLoadoutDisplay(available, picked, maxLoadout());
    return;
  }

  if (state.phase === 'paused') {
    // The pause button itself stays drawn and stays live, so pressing it twice
    // is a no-op rather than a trap. A child who taps it by accident gets out
    // of the panel exactly the way she got into it.
    if (hitTestPause(tap.x, tap.y)) {
      resumeRun();
      return;
    }
    const hit = hitTestMenu(pauseMenu(), tap.x, tap.y);
    if (!hit) return;
    audio.play('select');
    if (hit.id === 'resume') resumeRun();
    else leaveRun();
    return;
  }

  if (state.phase === 'won' || state.phase === 'lost') {
    const won = state.phase === 'won';
    // Endless has no NEXT, and `beginSetup` would look up level 0 and throw.
    if (currentLevelId === ENDLESS_ID) {
      const endHit = hitTestMenu(resultMenu(false, false), tap.x, tap.y);
      if (!endHit) return;
      audio.play('select');
      if (endHit.id === 'menu') state.phase = 'select';
      else beginEndless();
      return;
    }
    const hit = hitTestMenu(resultMenu(won, currentLevelId < LEVELS.length), tap.x, tap.y);
    if (!hit) return;
    audio.play('select');
    setUnlockBanner('');
    if (hit.id === 'menu') {
      state.phase = 'select';
    } else if (hit.id === 'next') {
      currentLevelId = Math.min(LEVELS.length, currentLevelId + 1);
      beginSetup();
    } else {
      beginSetup();
    }
  }
}

function toggleMute(): void {
  setMutedDisplay(audio.toggleMute());
  save.muted = audio.muted;
  writeSave(save);
  if (!audio.muted) audio.play('select');
}

/**
 * How many cards the tray holds — or how many toys exist, if that's fewer.
 *
 * Early levels have two or three toys in the world. The picker used to say
 * "PICK 5 TOYS" regardless, which reads as a requirement you cannot meet.
 */
function maxLoadout(): number {
  return Math.min(loadoutSlotsFor(currentLevelId), availableToys().length);
}

/** Everything unlocked by the time this level starts, in tray order. */
function availableToys(): ToyId[] {
  return unlockedBy(currentLevelId);
}

/**
 * Go from "a level was chosen" to either the picker or straight into the run.
 *
 * EASY is dealt `level.recommended` and skips the picker entirely. That is the
 * difficulty's headline lever: it removes a thing to CONSIDER, not a thing to
 * do, which is the whole shape of the EASY-to-NORMAL step.
 */
/**
 * Start an endless run.
 *
 * Skips the loadout picker on every difficulty, unlike the campaign. Endless
 * deals you everything you own — there is no lesson to build a five-card puzzle
 * around, and asking a child to choose five of fourteen before she has seen a
 * single wave of a mode she has never played is a wall.
 */
function beginEndless(): void {
  currentLevelId = ENDLESS_ID;
  // Toys she has actually unlocked, on the same rule as the kid roster in
  // `rosterFor`. This used to ask for `unlockedBy(LEVELS.length)` — every toy in
  // the game — so a first endless run straight after the bedroom was dealt attic
  // cards, while the kids walking in were correctly held back to ones she had
  // met. Two different definitions of "what she has" in one function.
  const owned = unlockedBy(save.unlocked);
  const seed = (Math.random() * 0xffffffff) >>> 0;
  endless = buildEndless(owned, save.unlocked, DIFFICULTIES[save.difficulty], new Rng(seed));
  // A tray's worth, not the whole cupboard. See `endlessKit`.
  const kit = endlessKit(owned, new Rng(seed ^ 0x5bf03635));
  picked = [...kit];
  state.start(endless.level, save.difficulty, kit, seed, endless.grow, endless.toughnessAt);
  particles.reset();
  resetHud();
  setUnlockBanner('');
  setEndlessScore(0, save.endlessBest);
  // Same reason as startRun: drop the tap that pressed the button, or the
  // first frame opens by placing a toy wherever the thumb happened to be.
  input.clear();
}

function beginSetup(): void {
  endless = null;
  const level = levelById(currentLevelId);
  const difficulty = DIFFICULTIES[save.difficulty];
  if (difficulty.loadoutIsPicked) {
    startRun(level.recommended);
    return;
  }
  // The picker opens EMPTY, and that is a fix rather than a default.
  //
  // It used to open with the recommended set already chosen, so that PLAY was
  // one tap away. What actually happened is that a player reads "PICK 2 TOYS",
  // taps the two toys — the only sensible reading of that instruction — and
  // thereby DESELECTS both, at which point PLAY silently refuses. The screen
  // punished you for doing exactly what it told you to do.
  //
  // Starting empty makes the instruction literally true: tap toys, they get a
  // tick, PLAY lights up.
  picked = [];
  setLoadoutDisplay(availableToys(), picked, maxLoadout());
  state.phase = 'loadout';
}

function startRun(loadout: readonly ToyId[]): void {
  state.start(levelById(currentLevelId), save.difficulty, loadout, (Math.random() * 0xffffffff) >>> 0);
  particles.reset();
  resetHud();
  setUnlockBanner('');
  // Drop the tap that pressed PLAY, so the first frame of the level doesn't
  // open by placing a toy in whatever cell happened to be under it.
  input.clear();
}

/**
 * Stop the clock. The run is untouched — see the `'paused'` note on `Phase`.
 *
 * Whatever is in her hand stays in it. Picking a card up, changing your mind
 * about where it goes and wanting a moment to think is the most likely reason
 * to press this at all, and a pause that quietly put the card back would be a
 * pause that punished the thing it is for.
 */
function pauseRun(): void {
  if (state.phase !== 'playing') return;
  audio.play('select');
  state.phase = 'paused';
}

function resumeRun(): void {
  state.phase = 'playing';
  // The same rule as PLAY on the loadout screen: drop the tap that dismissed
  // the panel, or the first frame back places a toy under wherever the thumb
  // happened to be — and here that thumb is over the middle of her own board.
  input.clear();
}

/**
 * Leave a run in progress.
 *
 * Endless keeps its score, and that is deliberate. The score is "waves
 * survived", she survived them, and `recordEndless` only ever raises the best —
 * so recording here can help her and cannot cost her anything. Stopping is not
 * losing, and a mode that quietly threw away twelve waves because she pressed
 * LEAVE instead of playing on until she was squeezed would be teaching her to
 * sit through an ending she doesn't want.
 *
 * A campaign level records nothing, for the same reason it records nothing on a
 * loss: stars are for finishing.
 */
function leaveRun(): void {
  if (currentLevelId === ENDLESS_ID) {
    const reached = state.waves.index;
    if (recordEndless(save, reached)) writeSave(save);
    setSaveForDisplay(save);
    setEndlessScore(reached, save.endlessBest);
  }
  endless = null;
  setUnlockBanner('');
  state.phase = 'select';
  input.clear();
}

// --- Gameplay taps ----------------------------------------------------------

/**
 * One tap during a run, in priority order.
 *
 * Sparkles are checked BEFORE the board. A drop lying on a cell is the thing a
 * child is aiming at, and losing 20 sparkles to an accidental placement is a
 * far worse outcome than failing to place a toy she can simply tap again.
 */
function routeGameTap(tap: Tap): void {
  // First, and safe to be first: the button sits in the footer's left corner,
  // where no cell, no card and no sparkle can reach — sparkles only ever fall on
  // cell centres, and column zero is centred well right of it.
  if (hitTestPause(tap.x, tap.y)) {
    pauseRun();
    return;
  }

  const card = hitTestCard(state.loadout, tap.x, tap.y);
  if (card) {
    state.selectCard(card.id);
    audio.play('select');
    return;
  }

  if (hitTestBroom(tap.x, tap.y)) {
    state.armSweep();
    audio.play('select');
    return;
  }

  if (state.collectSparkleAt(tap.x, tap.y) > 0) return;

  const cell = cellAt(tap.x, tap.y);
  if (!cell) return;

  // The broom goes before the card check because the two are never both in
  // hand — see `armSweep`. Arming and then tapping bare floor is not a mistake,
  // it is changing your mind, so it just puts the broom away.
  if (state.sweeping) {
    if (!state.sweep(cell.lane, cell.col)) audio.play('select');
    return;
  }

  if (state.selected) {
    state.tryPlace(cell.lane, cell.col);
    return;
  }

  // Nothing held: a tap on a toy you have only just put down takes it back.
  state.refund(cell.lane, cell.col);
}

function routeKey(action: KeyAction): void {
  if (state.phase === 'paused') {
    // Escape both opens and closes it, which is what a keyboard player expects
    // and what makes it safe to press without looking.
    if (action === 'cancel' || action === 'confirm') resumeRun();
    return;
  }
  if (state.phase !== 'playing') {
    if (action === 'confirm' && (state.phase === 'won' || state.phase === 'lost')) beginSetup();
    return;
  }
  if (action === 'cancel') {
    // Escape empties your hand first and only pauses once it is already empty.
    // Putting a card down is the far commoner intent, and a key that sometimes
    // stops the game and sometimes doesn't is still better than one that stops
    // it while you are mid-placement.
    if (state.selected || state.sweeping) {
      // Puts down whichever is in hand. `selectCard(null)` clears the broom too.
      state.selectCard(null);
      return;
    }
    pauseRun();
    return;
  }
  if (action === 'confirm') return;
  const index = Number(action.slice('card'.length)) - 1;
  const id = state.loadout[index];
  if (id) {
    state.selectCard(id);
    audio.play('select');
  }
}

// --- Presentation -----------------------------------------------------------

/**
 * Turn one simulation event into sound, particles and popups.
 *
 * This lives here rather than in the game so that `src/game/` stays unaware of
 * both renderers and speakers — the same boundary that keeps a second world a
 * set of new painters rather than a rewrite.
 */
function presentEvent(event: GameEvent): void {
  const random = (): number => state.rng.next();
  switch (event.type) {
    case 'place':
      audio.play('place');
      particles.place(event.x, event.y, random);
      break;
    case 'deny':
      audio.play('deny');
      break;
    case 'refund':
      audio.play('refund');
      addPopup(event.x, event.y, `+${event.value}`);
      break;
    case 'sweep':
      // No popup. A sweep pays nothing back, and a floating "+0" would be a
      // worse answer than none — it would read as the game short-changing her.
      audio.play('sweep');
      particles.place(event.x, event.y, random);
      break;
    case 'collect':
      audio.play('collect');
      particles.collect(event.x, event.y, random);
      addPopup(event.x, event.y, `+${event.value}`);
      break;
    case 'shoot':
      // Deliberately quiet and only sometimes. Every shooter firing every 1.4
      // seconds becomes a machine gun the moment there are four of them.
      if (random() < 0.4) audio.play('bubble');
      break;
    case 'hit':
      particles.splash(event.x, event.y, random);
      break;
    case 'shrug':
      audio.play('shrug');
      particles.shrug(event.x, event.y, random);
      break;
    case 'shield-break':
      audio.play('shield');
      particles.toyLost(event.x, event.y, '#a06a44', random);
      break;
    case 'down':
      audio.play('down');
      particles.kidLeaves(event.x, event.y, '#ffd6e8', random);
      addPopup(event.x, event.y, `+${event.value}`);
      break;
    case 'toy-lost':
      audio.play('toy-lost');
      particles.toyLost(event.x, event.y, '#ff8a6b', random);
      break;
    case 'wave':
      audio.play('wave');
      break;
    case 'big-wave':
      audio.play('big-wave');
      break;
    case 'nightlight':
      audio.play('light');
      particles.laneSweep(event.y, 0, 640, '#ffe98a', random);
      break;
    case 'powder':
      audio.play('powder');
      particles.laneSweep(event.y, 0, 640, '#fff0d9', random);
      break;
    case 'sweeper':
      // A Guard Bear firing. Loud and unmistakably a rescue, because it is
      // the moment a lane was about to be lost and wasn't.
      audio.play('sweeper');
      particles.laneSweep(event.y, 0, 640, '#7ee6a8', random);
      break;
    case 'boost':
      // Quiet and only sometimes, exactly like 'shoot'. A bath in front of a
      // Bubble Machine boosts three bubbles a second, and three of anything a
      // second is a drone rather than a signal.
      if (random() < 0.35) audio.play('boost');
      particles.bubblePop(event.x, event.y, random);
      break;
    case 'divert':
      audio.play('squeak');
      particles.place(event.x, event.y, random);
      break;
    case 'magnet':
      audio.play('magnet');
      particles.toyLost(event.x, event.y, '#a06a44', random);
      break;
    case 'thud':
      // A shot dying against a stack of boxes. Only sometimes, like 'shoot' and
      // 'boost' — a Water Gun parked behind a stack thuds every 1.5 seconds for
      // as long as it is there, and a sound that constant stops being a signal.
      // The puff of cardboard dust is drawn every time, because that is what
      // she needs to SEE to work out what is wrong.
      if (random() < 0.35) audio.play('thud');
      particles.shrug(event.x, event.y, random);
      break;
    case 'throw':
      audio.play('shield');
      break;
    case 'squeeze':
      audio.play('squeeze');
      squeezedThisStep = true;
      particles.kidLeaves(event.x, event.y, '#ff9ec7', random);
      break;
    case 'win':
      audio.play('win');
      finishRun(true, event.value);
      break;
    case 'lose':
      audio.play('lose');
      finishRun(false, 0);
      break;
    // Drops and toy chip damage are continuous and constant; a sound on each
    // would be a drone rather than information.
    case 'drop':
    case 'toy-hurt':
      break;
  }
}

function finishRun(won: boolean, stars: number): void {
  // Endless ends the only way it can, so it is the one run recorded on a LOSS.
  // Waves survived is the score; there are no stars and nothing to unlock.
  if (currentLevelId === ENDLESS_ID) {
    const reached = state.waves.index;
    if (recordEndless(save, reached)) writeSave(save);
    setSaveForDisplay(save);
    setEndlessScore(reached, save.endlessBest);
    return;
  }
  if (!won) return;
  const level = levelById(currentLevelId);
  if (recordResult(save, currentLevelId, stars)) writeSave(save);
  setSaveForDisplay(save);
  const unlocked = level.unlocks.filter((id) => id !== 'jar' && id !== 'wand');
  if (unlocked.length > 0 && currentLevelId > 1) {
    setUnlockBanner(unlocked.map((id) => TOYS[id].name).join(' + '));
  }
}

// --- The loop ---------------------------------------------------------------

function step(dt: number): void {
  // Any touch at all is a valid gesture to start audio with; browsers refuse to
  // create an AudioContext before one. The screen wake lock wants a gesture for
  // the same reason, and re-arms here because a lock is dropped every time the
  // page is hidden and never handed back on its own.
  if (input.consumeAnyPress()) {
    audio.unlock();
    wakeLock.arm();
  }

  squeezedThisStep = false;

  input.drainTaps((tap) => {
    if (state.phase === 'playing') routeGameTap(tap);
    else routeMenuTap(tap);
  });
  input.drainKeys(routeKey);

  state.update(dt);
  state.drainEvents(presentEvent);

  particles.update(dt);
  updateHud(dt);
  advanceScene(dt, squeezedThisStep);
}

startLoop({
  update: step,
  render(alpha) {
    sceneRenderer.draw(viewport.ctx, state, input, alpha, particles);
  },
});

/**
 * Register the service worker in production only.
 *
 * Deliberately not in dev: a caching worker sitting in front of the Vite dev
 * server intercepts module requests and serves stale code, which produces
 * "I changed the file and nothing happened" bugs that cost far more time than
 * the worker saves.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((error) => console.warn('[sw] registration failed', error));
  });
}

// Dev-only handle for poking at a live run from the console.
if (import.meta.env.DEV) {
  void Promise.all([import('./dev/verify'), import('./dev/tune'), import('./dev/art')]).then(([v, t, a]) => {
    (window as unknown as Record<string, unknown>).__game = {
      state,
      input,
      viewport,
      audio,
      particles,
      save,
      startRun,
      verify: v.verify,
      // Whether the generated sheets match the grid the slicer cuts. Run by
      // hand after an art run — see the note at the top of dev/art.ts.
      checkArt: a.checkArt,
      /** Re-run the design contracts on demand, rather than reading them out of
       *  a console buffer that also holds every previous page load's. */
      contracts: () => [
        ...validateDesignContracts(),
        ...validateTrayContracts(),
        ...validateHudContracts(),
      ],
      tune: t.tune,
      showTuning: t.showTuning,
      // Lets a test drive the real loop body when rAF is unavailable — e.g. a
      // backgrounded tab, where the browser suspends animation frames entirely.
      step,
      /** Jump straight to a level, bypassing the unlock gate. */
      go(id: number, difficulty: DifficultyId = save.difficulty): void {
        save.difficulty = difficulty;
        currentLevelId = id;
        startRun(levelById(id).recommended);
      },
      /**
       * The generated art, as the renderer sees it.
       *
       * `frames('toddler.walk')` returns the sliced, re-registered, mirrored
       * canvases — which is the only way to check a walk cycle honestly. Judging
       * one by watching a 20-pixel character cross the board means judging the
       * slicer, the sheet and the cadence all at once, and every problem in that
       * stack looks the same from there.
       */
      sprites: { get: sprite, frames: spriteFrames },
      wakeLock,
      /** Unlock everything, for looking at the late levels. */
      unlockAll(): void {
        save.unlocked = LEVELS.length;
        writeSave(save);
        setSaveForDisplay(save);
      },
    };
  });
}
