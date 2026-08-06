import { Audio } from './core/audio';
import { Input, type KeyAction, type Tap } from './core/input';
import { startLoop } from './core/loop';
import { Viewport } from './core/viewport';
import {
  freshSave,
  loadSave,
  recordResult,
  writeSave,
  type Save,
} from './core/save';
import { DIFFICULTIES, cellAt, type DifficultyId } from './game/config';
import { LEVELS, levelById, unlockedBy } from './game/levels';
import { GameState, validateDesignContracts, type GameEvent } from './game/state';
import { TOYS, type ToyId } from './game/toys';
import { Particles } from './render/particles';
import {
  advanceScene,
  sceneRenderer,
  setLoadoutDisplay,
  setSaveForDisplay,
  setUnlockBanner,
} from './render/scene';
import { addPopup, resetHud, updateHud } from './ui/hud';
import {
  hitTestMenu,
  levelMenu,
  loadoutMenu,
  muteButton,
  resultMenu,
  setMutedDisplay,
  titleMenu,
} from './ui/screens';
import { hitTestCard, validateTrayContracts } from './ui/tray';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('#game canvas missing');

const viewport = new Viewport(canvas);
const input = new Input(viewport);
const state = new GameState();
const particles = new Particles();
const audio = new Audio();

/**
 * Surface any broken design contract loudly, on every load.
 *
 * These are the fairness guarantees the whole game is tuned around, and they
 * break silently otherwise — a levelling change that makes HARD unwinnable
 * looks exactly like a levelling change that doesn't.
 */
for (const problem of [...validateDesignContracts(), ...validateTrayContracts()]) {
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
    const hit = hitTestMenu(titleMenu(), tap.x, tap.y);
    if (!hit) return;
    audio.play('select');
    save.difficulty = hit.id.slice('diff:'.length) as DifficultyId;
    writeSave(save);
    state.phase = 'select';
    return;
  }

  if (state.phase === 'select') {
    const hit = hitTestMenu(levelMenu(save), tap.x, tap.y);
    if (!hit) return;
    audio.play('select');
    if (hit.id === 'back') {
      state.phase = 'title';
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

  if (state.phase === 'won' || state.phase === 'lost') {
    const won = state.phase === 'won';
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
  return Math.min(5, availableToys().length);
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
function beginSetup(): void {
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

// --- Gameplay taps ----------------------------------------------------------

/**
 * One tap during a run, in priority order.
 *
 * Sparkles are checked BEFORE the board. A drop lying on a cell is the thing a
 * child is aiming at, and losing 20 sparkles to an accidental placement is a
 * far worse outcome than failing to place a toy she can simply tap again.
 */
function routeGameTap(tap: Tap): void {
  const card = hitTestCard(state.loadout, tap.x, tap.y);
  if (card) {
    state.selectCard(card.id);
    audio.play('select');
    return;
  }

  if (state.collectSparkleAt(tap.x, tap.y) > 0) return;

  const cell = cellAt(tap.x, tap.y);
  if (!cell) return;

  if (state.selected) {
    state.tryPlace(cell.lane, cell.col);
    return;
  }

  // Nothing held: a tap on a toy you have only just put down takes it back.
  state.refund(cell.lane, cell.col);
}

function routeKey(action: KeyAction): void {
  if (state.phase !== 'playing') {
    if (action === 'confirm' && (state.phase === 'won' || state.phase === 'lost')) beginSetup();
    return;
  }
  if (action === 'cancel') {
    state.selectCard(null);
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
      // The Toy Vacuum firing. Loud and unmistakably a rescue, because it is
      // the moment a lane was about to be lost and wasn't.
      audio.play('sweeper');
      particles.laneSweep(event.y, 0, 640, '#7ee6a8', random);
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
  // create an AudioContext before one.
  if (input.consumeAnyPress()) audio.unlock();

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
  void Promise.all([import('./dev/verify'), import('./dev/tune')]).then(([v, t]) => {
    (window as unknown as Record<string, unknown>).__game = {
      state,
      input,
      viewport,
      audio,
      particles,
      save,
      startRun,
      verify: v.verify,
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
      /** Unlock everything, for looking at the late levels. */
      unlockAll(): void {
        save.unlocked = LEVELS.length;
        writeSave(save);
        setSaveForDisplay(save);
      },
    };
  });
}
