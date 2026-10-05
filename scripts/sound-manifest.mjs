/**
 * What to ask Gemini to SAY and PLAY: voice lines (text-to-speech) and music
 * (Lyria). Ported from ../slingshot/scripts/sound-manifest.mjs, which is where
 * every rule below was learned the hard way (slingshot DECISIONS 16, 18, 19).
 *
 * The physical sounds (bubbles, squirts, squeaks, chimes) stay synthesised in
 * src/core/sfx.ts: no available model makes sound effects. Lyria, asked for
 * one explosion, wrote a polka with an explosion in the middle.
 *
 * ## Voice direction must not be spoken
 *
 * Direction written as plain text gets read aloud, and a system instruction
 * is refused by the TTS models. The format that works is a director's-notes
 * prompt where only the `#### TRANSCRIPT` is spoken (`voicePrompt` below).
 *
 * ## Cartoon = short and high, and nobody talks much
 *
 * Every line is two or three words. The kids are sped up at playback (the
 * `rate` below, written into the sound index so it can be retuned without
 * re-recording), which is the classic cartoon-voice trick: shorter AND higher.
 * Ellie plays at natural speed, because in slingshot she and the raccoons
 * sounded alike once both were sped up.
 *
 * ## Nobody is hurt
 *
 * The kids are not enemies being beaten. They come to squeeze the unicorn, and
 * they leave because the bubbles were more fun. Their lines are delighted
 * ("Wheee!", "Bubbles!"), never hurt; their squeeze line is a hug.
 */

/** Ellie: the same voice and direction as slingshot, so she is one girl across the set. */
const ELLIE = {
  voice: 'Zephyr',
  rate: 1,
  profile:
    'a little cartoon girl from a children\'s TV cartoon, about five years old: high, bright, squeaky ' +
    'and bouncy, innocent and goofy, like an animated kid sidekick. NOT grown-up, NOT breathy, NOT ' +
    'soft or sultry: a loud happy little kid',
};

/**
 * The kids who come for the unicorn: toddlers and little kids. Puck is the
 * voice slingshot's raccoons use, and it came back properly cartoonish at
 * this speed-up; the kids here are giddy rather than cheeky.
 */
const KID = {
  voice: 'Puck',
  rate: 1.3,
  profile:
    'a tiny giddy toddler from a children\'s TV cartoon: very high, squeaky and giggly, chipmunk-like, ' +
    'delighted by everything, never sad, never mean',
};

/**
 * The Big Kid: a bigger, slower, goofier voice, so the boss sounds like the
 * boss. Fenrir was tried first and came back as giggles wrapped round a
 * mumbled word, three times; Charon says the word.
 */
const BIG_KID = {
  voice: 'Charon',
  rate: 1.12,
  profile:
    'a big goofy cartoon kid from a children\'s TV cartoon, about eight, clumsy and cheerful, a little ' +
    'loud and dopey, never scary or mean',
  // The generic note asks for high-pitched, which fought this profile and came
  // back as giggles around the word. He says the line and nothing else.
  note: 'Cartoon voice acting: say only the transcript, once, no giggles, no extra words.',
};

function line(id, who, style, text) {
  return { id, kind: 'voice', who, style, text };
}

/**
 * Music (Lyria). Each clip is about thirty seconds; the player in
 * src/core/audio.ts finds the steady part by RMS and crossfades it into a
 * loop. Every prompt asks for no intro and no ending for that reason.
 *
 * One theme per room, because a world here is a different place (a bedroom at
 * night, a sunny garden, a steamy bath, a dusty attic) and the music is most
 * of what makes it feel like one. Plus the busy theme that takes over for a
 * big wave, and the two stings.
 */
const STEADY =
  'Gentle enough to play under sound effects. A steady groove the whole way through: no intro, no ' +
  'build-up, no ending and no fade-out, so it can loop. Instrumental, no vocals.';

function music(id, prompt) {
  return { id, kind: 'music', prompt: `${prompt} ${STEADY}` };
}

/** A short one-shot. `seconds` is how much of the clip is kept; the rest is cut with a fade. */
function sting(id, seconds, prompt) {
  return { id, kind: 'sting', seconds, prompt };
}

export const SOUNDS = [
  // --- Ellie -------------------------------------------------------------------
  // She sits in the nook beside the unicorn (DECISIONS 32). Few lines, used
  // rarely: wave starts, a happy cheer now and then, the end of a level.
  line('e.herethey', ELLIE, 'excited, a little breathless, pointing', 'Here they come!'),
  line('e.lots', ELLIE, 'wide-eyed, excited, not scared', 'Lots of them!'),
  line('e.yay', ELLIE, 'delighted, cheering', 'Yay!'),
  line('e.hooray', ELLIE, 'bouncing, cheering', 'Hooray!'),
  line('e.won', ELLIE, 'thrilled and proud', 'We did it!'),
  line('e.ohno', ELLIE, 'disappointed but cheerful', 'Oh no!'),
  line('e.gentle', ELLIE, 'protective, a little cross, playful', 'Hey! Gentle!'),
  line('e.again', ELLIE, 'cheerful, determined, already over it', "Let's try again!"),
  line('e.wow', ELLIE, 'wide-eyed amazement', 'Woooow!'),

  // --- The kids -------------------------------------------------------------------
  // Turned happy: the bubbles/water/light won, and they wander off delighted.
  line('k.wheee', KID, 'giddy, sliding away happily', 'Wheee!'),
  line('k.bubbles', KID, 'delighted discovery, squealing', 'Bubbles!'),
  line('k.giggle', KID, 'a short burst of giggles', 'Hee hee hee!'),
  line('k.bye', KID, 'sing-song, waving', 'Bye-bye!'),
  line('k.splashy', KID, 'squealing with joy, getting wet', 'Splashy!'),
  // Reaching the unicorn. A hug, not an attack.
  line('k.squishy', KID, 'blissful, hugging something very soft', 'Squishyyy!'),
  line('k.unicorn', KID, 'overjoyed, arms out', 'Unicorn!'),
  // The Guard Bear scoops a kid into a hug.
  line('k.teddy', KID, 'surprised and delighted, one word', 'Teddy!'),
  // The Big Kid throws a stuffie at a toy.
  line('b.catch', BIG_KID, 'goofy, throwing something', 'Catch!'),
  line('b.mine', BIG_KID, 'goofy, grabby, pleased with himself', 'Mine now!'),

  // --- Music ------------------------------------------------------------------------
  music(
    'music.title',
    "A sweet, magical title theme for a children's cartoon game about a stuffed unicorn and her toys: " +
      'music box, celesta, soft pizzicato strings, warm ukulele and a little glockenspiel sparkle, ' +
      'dreamy but bouncy, 96 bpm.',
  ),
  music(
    'music.build',
    "Calm, curious 'getting ready' music for a children's toy game, for choosing toys from a toy box: " +
      'soft marimba, plucked upright bass, gentle brushed snare, a toy piano melody, thoughtful and ' +
      'cosy, 92 bpm.',
  ),
  music(
    'music.bedroom',
    "Cosy, playful night-time bedroom music for a children's cartoon game where little kids sneak in " +
      'to hug a unicorn plush and toys keep them busy: music box, soft pizzicato strings, warm bass, ' +
      'brushed drums, a sneaky-tiptoe feel, sweet and never scary, 104 bpm.',
  ),
  music(
    'music.backyard',
    "Sunny, bouncy backyard music for a children's cartoon game with a paddling pool and water " +
      'toys: ukulele, steel drum, whistling melody, hand claps, light shaker and soft drums, summery ' +
      'and silly, 112 bpm.',
  ),
  music(
    'music.bath',
    "Bubbly, splashy bath-time music for a children's cartoon game with rubber ducks and bubbles: " +
      'plinky marimba, glockenspiel, pizzicato, a bouncy tuba bass and playful woodblock, light and ' +
      'giggly, 108 bpm.',
  ),
  music(
    'music.attic',
    "Curious, a-little-mysterious attic music for a children's cartoon game in a dusty attic full of " +
      'boxes: pizzicato strings, bassoon, toy piano, soft vibraphone and a tiptoeing bass, playful and ' +
      'friendly, never spooky, 100 bpm.',
  ),
  music(
    'music.busy',
    "Exciting, busy 'here comes a big crowd' music for a children's cartoon tower-defense game with " +
      'toys: fast pizzicato strings, bouncy brass stabs, xylophone runs, driving but light drums, ' +
      'energetic and fun, never scary or aggressive, 132 bpm.',
  ),
  sting(
    'sting.win',
    5,
    "A short, joyful victory fanfare for a children's cartoon game: bright toy trumpets, glockenspiel " +
      'and a cymbal sparkle, triumphant and happy, starting immediately. Instrumental, no vocals.',
  ),
  sting(
    'sting.lose',
    4,
    "A short, gentle 'aww, try again' musical sting for a children's cartoon game: a soft descending " +
      'toy piano and muted trombone wah-wah, warm and funny, not sad, starting immediately. ' +
      'Instrumental, no vocals.',
  ),
];

/** The TTS prompt. Only the TRANSCRIPT section is spoken. */
export function voicePrompt(s) {
  return [
    `# AUDIO PROFILE: ${s.who.profile}`,
    "## DIRECTOR'S NOTES",
    `Style: ${s.style}. ${s.who.note ?? 'Cartoon voice acting, short, punchy and high-pitched.'}`,
    '#### TRANSCRIPT',
    s.text,
  ].join('\n');
}
