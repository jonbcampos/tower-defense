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

export const STYLE = [
  "children's picture book illustration, soft rounded shapes, thick clean dark outlines,",
  'flat pastel colours with simple soft shading, cheerful and cosy,',
  'palette of dusty purple, blush pink, cream, mint and warm gold,',
  'a single centred subject filling most of the frame,',
  'flat solid pure green (#00FF00) background, absolutely no background details,',
  'no text, no letters, no watermark, no drop shadow on the background,',
  'clean edges suitable for cutting out as a game sprite',
].join(' ');

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
      'a small square blue patterned childrens rug lying flat on the floor, seen from a low angle, ' +
      'soft fringed edges.',
  },
  {
    id: 'door',
    aspect: '9:16',
    subject:
      'an open bedroom doorway seen straight on, warm golden hallway light spilling through from ' +
      'behind, wooden door frame. Dark inviting opening.',
  },
  {
    // The only piece with no green screen: it IS the background.
    id: 'room',
    aspect: '16:9',
    background: 'none',
    subject:
      'the empty interior of a cosy little girls bedroom at dusk, seen straight on from across the ' +
      'room: a dusty purple wall with pale wainscot panelling along the bottom, and a plain warm ' +
      'purple-grey carpet floor filling the lower two thirds. Completely empty — no furniture, no ' +
      'toys, no people, no door. Soft warm lamplight. Wide and uncluttered, meant to be a background.',
  },
];

/** The full prompt for one piece. */
export function promptFor(piece) {
  if (piece.background === 'none') {
    return `${piece.subject} ${STYLE.replace(
      'flat solid pure green (#00FF00) background, absolutely no background details,',
      '',
    )}`;
  }
  return `${piece.subject} ${STYLE}`;
}
