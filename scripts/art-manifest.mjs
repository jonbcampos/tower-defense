/**
 * What art to generate, and the prompt for each piece.
 *
 * This file is the art direction. `generate-art.mjs` is just plumbing.
 *
 * Three rules keep a generated set from looking like a ransom note:
 *
 *  1. **One STYLE string, shared by everything.** Every prompt is the same
 *     paragraph of style plus one sentence of subject. If you want the look to
 *     change, change STYLE once and regenerate everything — never tweak the
 *     style inside one entry, or that piece will drift away from the rest.
 *  2. **Facing matters and is not negotiable.** Kids walk leftwards, so they
 *     are drawn facing left. Toys shoot rightwards, so they face right. A
 *     beautiful sprite facing the wrong way is a bug, because which way a thing
 *     points is how the player reads what it does.
 *  3. **Silhouette first.** Each prompt names the shape it must read as at
 *     thumbnail size. These are drawn 30 pixels tall in play; if the outline
 *     isn't distinct, no amount of rendering detail will save it.
 *
 * The `key` colour is a flat background that gets removed at load time. Pure
 * green is used because nothing in the game's palette is anywhere near it —
 * the slime and the vacuum are yellow-greens, a long way from #00FF00.
 */

/**
 * The chroma-key demand, for every piece that is a cut-out sprite.
 *
 * First and loudest, because it is the one instruction that has to be obeyed.
 * In the first full run the model quietly gave the raincoat a white background
 * instead — which the load-time cut-out survived, but only because it keys on
 * whatever colour it finds rather than on green. White is genuinely dangerous
 * here: half the cast is pale, and a cream boot touching the frame edge would
 * be eaten along with the backdrop.
 */
const KEY_BACKGROUND = [
  'THE BACKGROUND MUST BE FLAT SOLID CHROMA-KEY GREEN, hex #00FF00, pure saturated green,',
  'covering every pixel that is not the subject. No white, no gradient, no vignette,',
  'no shadow cast onto the background, no floor, no scenery, no border.',
].join(' ');

/** How everything is drawn. Shared by sprites and backgrounds alike. */
const DRAW_STYLE = [
  "children's picture book illustration, soft rounded shapes,",
  'thick clean dark outlines, flat pastel colours with simple soft shading, cheerful and cosy,',
  'palette of dusty purple, blush pink, cream, mint and warm gold,',
  'no text, no letters, no watermark',
].join(' ');

/** Kept as one string for anything that wants to read the whole style at once. */
export const STYLE = `${KEY_BACKGROUND} ${DRAW_STYLE}`;

/**
 * `id` must match the ToyId / EnemyKind / scenery name the renderer looks up.
 * Adding a new toy means adding its entry here as well as in `toys.ts`.
 */
export const PIECES = [
  // --- The star -------------------------------------------------------------
  {
    id: 'unicorn',
    aspect: '1:1',
    subject:
      'a plush stuffed toy unicorn sitting upright facing the viewer, cream-white fur, ' +
      'a gold spiral horn, a lilac-purple mane, rosy cheeks, big friendly eyes, stubby soft legs. ' +
      'It should read as a cuddly toy, not a real horse.',
  },

  // --- Toys. All facing RIGHT, because they shoot towards the door. ---------
  {
    id: 'jar',
    aspect: '1:1',
    subject:
      'a small glass jar with a lid, full of glowing gold glitter that spills light out of the top. ' +
      'Silhouette: a round jar. Warm gold glow.',
  },
  {
    id: 'wand',
    aspect: '1:1',
    subject:
      'a bubble wand standing upright in a little base: a slim stick with a round hoop on top, ' +
      'a soap film shimmering in the hoop and one or two bubbles drifting off to the right. ' +
      'Silhouette: a stick with a ring on top.',
  },
  {
    id: 'fort',
    aspect: '1:1',
    subject:
      'a small fort built of stacked pink and cream bed pillows, squat and wide and soft. ' +
      'Silhouette: a low chunky block. No face, no character.',
  },
  {
    id: 'sprinkler',
    aspect: '1:1',
    subject:
      'a garden sprinkler on a small base, with a spinning cross-shaped head throwing arcs of ' +
      'water up and outward on both sides. Silhouette: an upright post topped with a cross.',
  },
  {
    id: 'watergun',
    aspect: '1:1',
    subject:
      'a chunky toy water pistol pointing to the RIGHT, blue and white, with a clear tank of water ' +
      'on top and a stubby grip below. Silhouette: a barrel pointing right.',
  },
  {
    id: 'nightlight',
    aspect: '1:1',
    subject:
      'a star-shaped nightlight glowing warm yellow on a little white plug base, casting a soft halo. ' +
      'Silhouette: a five-pointed star. The only star-shaped object in the set.',
  },
  {
    id: 'slime',
    aspect: '1:1',
    subject:
      'a flat puddle of glossy lime-green toy slime spread on the floor, seen from a low angle, ' +
      'with a few shiny highlights and bubbles. Silhouette: a wide flat blob, very low.',
  },
  {
    id: 'powder',
    aspect: '1:1',
    subject:
      'a round cream-coloured baby powder puffer bottle with a rubber squeeze bulb on its side, ' +
      'a small cloud of white powder escaping the top. Silhouette: a ball with a bulb.',
  },
  {
    id: 'fountain',
    aspect: '1:1',
    subject:
      'a small two-tier toy fountain in pink and gold, with gold sparkles arcing up out of the top ' +
      'and falling into the basin. Silhouette: a wide tiered cone.',
  },
  {
    id: 'machine',
    aspect: '1:1',
    subject:
      'a boxy lilac bubble machine with three nozzles on its RIGHT side, each blowing a stream of ' +
      'bubbles rightward, and a little window showing soapy liquid. Silhouette: a box with three spouts.',
  },
  {
    id: 'vacuum',
    aspect: '1:1',
    subject:
      'a small round robot vacuum cleaner, mint green and white, with one friendly glowing eye, ' +
      'seen from a low three-quarter angle. Silhouette: a low disc.',
  },

  // --- Kids. All facing LEFT, because they walk towards the unicorn. --------
  // Every one of them is happy and means no harm: they want a cuddle. Nothing
  // in this set may look menacing, angry or frightening.
  {
    id: 'crawler',
    aspect: '1:1',
    subject:
      'a happy baby in a green romper crawling on hands and knees, facing LEFT, seen from the side, ' +
      'arms reaching forward eagerly. Silhouette: low and wide, close to the ground.',
  },
  {
    id: 'toddler',
    aspect: '1:1',
    subject:
      'a cheerful toddler in an orange t-shirt walking to the LEFT, seen from the side, ' +
      'both arms stretched out in front wanting a hug, big head, stubby legs mid-step.',
  },
  {
    id: 'runner',
    aspect: '1:1',
    subject:
      'an excited child in a pink top running fast to the LEFT, body leaning forward, ' +
      'one arm trailing behind, hair blown back. Silhouette: tilted forward, clearly sprinting.',
  },
  {
    id: 'raincoat',
    aspect: '1:1',
    subject:
      'a child in a bright yellow hooded raincoat walking to the LEFT, the hood UP and clearly ' +
      'pointed, water droplets visibly bouncing off the shiny coat. Silhouette: a bell-shaped coat ' +
      'with a sharp pointed hood — the most distinctive outline in the set.',
  },
  {
    id: 'blanket',
    aspect: '1:1',
    subject:
      'a child completely hidden under a draped lilac blanket, like a little ghost, shuffling to ' +
      'the LEFT with only bare feet showing at the bottom. No face at all. Silhouette: a soft mound.',
  },
  {
    id: 'balloon',
    aspect: '1:1',
    subject:
      'a delighted small child floating in the air, held up by a big pink helium balloon above ' +
      'their head, legs dangling, drifting to the LEFT. Silhouette: a balloon above a hanging child.',
  },
  {
    id: 'puffy',
    aspect: '1:1',
    subject:
      'a child in an enormous puffy quilted blue winter coat walking to the LEFT, so padded they ' +
      'look almost round, tiny head poking out of the top. Silhouette: a big soft ball.',
  },
  {
    id: 'slider',
    aspect: '1:1',
    subject:
      'a laughing child in stripey socks sliding along the floor on their front, arms forward, ' +
      'moving fast to the LEFT, with little speed lines behind. Silhouette: horizontal, low, unlike ' +
      'every other child in the set who is upright.',
  },
  {
    id: 'wagon',
    aspect: '1:1',
    subject:
      'a happy child riding in a little red toy wagon rolling to the LEFT, with a cardboard box lid ' +
      'held up in front of them like a shield. Silhouette: wide, with two round wheels.',
  },
  {
    id: 'bigkid',
    aspect: '1:1',
    subject:
      'a big grinning older child, much larger than the others, striding to the LEFT with both arms ' +
      'flung wide open for an enormous hug, a plush toy tucked under one arm. Friendly and boisterous, ' +
      'never scary. Silhouette: tall and very wide.',
  },

  // --- Scenery --------------------------------------------------------------
  {
    id: 'cushion',
    aspect: '1:1',
    subject:
      'a plump pink velvet floor cushion with a frilled edge, seen from a low three-quarter angle, ' +
      'empty and waiting to be sat on.',
  },
  {
    id: 'rug',
    aspect: '1:1',
    subject:
      'a square patterned childrens rug seen from DIRECTLY OVERHEAD, perfectly flat and top-down, ' +
      'filling the whole square frame edge to edge like a floor tile. Deep blue and teal with a ' +
      'simple repeating pattern. No perspective, no thickness, no visible edges lifting up, no ' +
      'fringe sticking out, no shadow. It must read as part of the floor, not as an object sitting ' +
      'on top of the floor.',
  },
  {
    // The pretty one, shown behind the menus only.
    //
    // A detailed perspective bedroom is lovely to look at and actively bad to
    // play on: it competes with the characters, and its horizon sits nowhere
    // near where a flat five-lane grid starts. So it gets its own piece and its
    // own job. This is the postcard; `room` below is the pitch.
    id: 'menu',
    aspect: '16:9',
    background: 'none',
    size: '2K',
    subject:
      'The cosy interior of a little girls bedroom at dusk, seen straight on from across the room ' +
      'in gentle perspective: dusty purple walls with pale cream wainscot panelling, a warm glowing ' +
      'wall lamp, two small framed pictures, a soft carpet floor, and a plush toy unicorn sitting ' +
      'on a pink floor cushion on the left. Warm, inviting and detailed. No people, no text.',
  },
  {
    // The only piece with no green screen: it IS the background.
    id: 'room',
    aspect: '16:9',
    background: 'none',
    // The one piece that needs resolution. Everything else is drawn ~30px tall
    // and downscales from 512; this is stretched across the whole 640px frame
    // at up to 2x device pixel ratio, so 512 would visibly soften.
    size: '2K',
    // Composition, not decoration. The board is a flat grid of five lanes, and
    // the first attempt came back as a lovely PERSPECTIVE room — converging
    // side walls, a ceiling, a horizon two-thirds down — which fights a flat
    // grid badly and put the wall/floor join nowhere near where the board
    // starts. This version specifies the layout in proportions instead:
    // a wall strip across the top sixth, plain carpet for the rest.
    subject:
      'A FLAT ORTHOGRAPHIC GAME BACKGROUND with NO PERSPECTIVE and NO VANISHING POINT. ' +
      'The TOP ONE SIXTH of the image is a dusty purple bedroom wall with a pale cream skirting ' +
      'board running horizontally along its bottom edge. The REMAINING FIVE SIXTHS below it is ' +
      'plain, even, slightly textured warm purple-grey carpet, flat and uniform, filling the whole ' +
      'width. Straight-on and perfectly horizontal: no ceiling, no side walls, no corners, no ' +
      'horizon line, no furniture, no toys, no people, no door, no rug. Rich and slightly dark so ' +
      'that pale characters placed on top of it stand out. Soft even lighting, no hotspots.',
  },
];

/**
 * The full prompt for one piece.
 *
 * Composed from named parts rather than by editing a finished string. The
 * previous version deleted the chroma-key sentence out of `STYLE` with a
 * literal `.replace()` for the two full-bleed backgrounds — and then the
 * sentence was reworded, the replace silently matched nothing, and both
 * backgrounds came back as a small room floating in a field of pure green.
 * String surgery on a prompt fails quietly and looks like a model problem.
 */
export function promptFor(piece) {
  if (piece.background === 'none') {
    return `${piece.subject} ${DRAW_STYLE}. This is a full-bleed background image: it must fill the entire frame edge to edge, with no border and no chroma-key colour anywhere.`;
  }
  return `${KEY_BACKGROUND} Subject: ${piece.subject} A single centred subject filling most of the frame. ${DRAW_STYLE}, clean crisp edges suitable for cutting out against pure green #00FF00.`;
}
