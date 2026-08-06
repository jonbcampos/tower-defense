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
 *
 * A piece with a `cycle` also gets a second, derived piece — a 2x2 sprite sheet
 * of that character mid-move — built at the bottom of this file. See SHEET.
 */
const BASE_PIECES = [
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
    // Faces RIGHT with the toys, not left with the kids: he is on your side.
    id: 'bear',
    aspect: '1:1',
    subject:
      'a small plush teddy bear standing guard and facing RIGHT, honey-brown fur, a mint green ' +
      'ribbon bow at his neck, both arms held out in front of him ready to catch someone in a big ' +
      'hug, brave and friendly expression. He is a stuffed toy like the unicorn, not a real bear. ' +
      'Silhouette: a stocky little bear with its arms out.',
  },

  // --- Kids. All facing LEFT, because they walk towards the unicorn. --------
  // Every one of them is happy and means no harm: they want a cuddle. Nothing
  // in this set may look menacing, angry or frightening.
  {
    id: 'crawler',
    aspect: '1:1',
    subject:
      'a happy baby crawling on hands and knees, facing LEFT, seen from the side, arms reaching ' +
      'forward eagerly. She wears a ONE-PIECE green romper of a SINGLE FLAT GREEN, covering the ' +
      'whole body and BOTH legs right down to the ankles — no nappy, no cream or white patch over ' +
      'the bottom or the legs, no second colour anywhere on it. ' +
      'Silhouette: low and wide, close to the ground.',
    cycle:
      'a crawl. Frame 1: left hand and right knee reaching forward, body stretched long. ' +
      'Frame 2: gathered up, both hands under the shoulders, bottom raised highest. ' +
      'Frame 3: right hand and left knee reaching forward, body stretched long. ' +
      'Frame 4: gathered up again, the mirror of frame 2.',
  },
  {
    id: 'toddler',
    aspect: '1:1',
    subject:
      'a cheerful toddler in an orange t-shirt walking to the LEFT, seen from the side, ' +
      'both arms stretched out in front wanting a hug, big head, stubby legs mid-step.',
    cycle:
      'a toddling walk. Frame 1: the NEAR leg is forward and planted, the FAR leg trails behind, ' +
      'body at its lowest. Frame 2: the legs pass and overlap, up on the toes, body at its ' +
      'highest. Frame 3: THE OPPOSITE OF FRAME 1 — the FAR leg is now forward and planted and the ' +
      'NEAR leg trails behind. Frame 4: the legs pass and overlap again, body at its highest.',
  },
  {
    id: 'runner',
    aspect: '1:1',
    subject:
      'an excited child in a pink top running fast to the LEFT, body leaning forward, ' +
      'one arm trailing behind, hair blown back. Silhouette: tilted forward, clearly sprinting.',
    cycle:
      'a full run. Frame 1: the NEAR leg reaches far forward and the FAR leg stretches far back, ' +
      'both feet off the ground, fully extended. Frame 2: the NEAR foot is planted underneath and ' +
      'the FAR knee drives up in front, body compressed and lowest. Frame 3: THE OPPOSITE OF ' +
      'FRAME 1 — the FAR leg reaches far forward and the NEAR leg stretches far back. Frame 4: ' +
      'THE OPPOSITE OF FRAME 2 — the FAR foot is planted underneath and the NEAR knee drives up. ' +
      'Arms swing opposite the legs throughout.',
  },
  {
    id: 'raincoat',
    aspect: '1:1',
    subject:
      'a child in a bright yellow hooded raincoat walking to the LEFT, the hood UP and clearly ' +
      'pointed, water droplets visibly bouncing off the shiny coat. Silhouette: a bell-shaped coat ' +
      'with a sharp pointed hood — the most distinctive outline in the set.',
    cycle:
      'a walk in a stiff plastic coat. Frame 1: left welly boot forward and planted, the coat hem ' +
      'swung back. Frame 2: boots together, the coat hanging straight and still. Frame 3: right ' +
      'welly boot forward and planted, the coat hem swung the other way. Frame 4: boots together, ' +
      'coat hanging straight. The hood stays UP and pointed in all four frames.',
  },
  {
    id: 'blanket',
    aspect: '1:1',
    subject:
      'a child completely hidden under a draped lilac blanket, like a little ghost, shuffling to ' +
      'the LEFT with only bare feet showing at the bottom. No face at all. Silhouette: a soft mound.',
    cycle:
      'a blind shuffle. Frame 1: leaning left, the left bare foot poking out from under the hem. ' +
      'Frame 2: upright and gathered, the blanket settling, both feet hidden. Frame 3: leaning ' +
      'right, the right bare foot poking out. Frame 4: upright and gathered again. Short steps ' +
      'and a lot of side-to-side rocking. Still no face in any frame.',
  },
  {
    id: 'balloon',
    aspect: '1:1',
    // The only one that is not standing on anything. Lining her frames up on
    // their lowest pixel would pin her dangling feet to a floor she never
    // touches and cancel the float; her frames line up on their centres instead.
    align: 'center',
    // READ THIS BEFORE EDITING. The first version said "held up by a balloon
    // above their head, legs dangling" and the model drew exactly that: the
    // string running to the top of the child's head, arms at their sides, body
    // hanging straight and perfectly limp. It looks like a hanging. In a game
    // for a five-year-old.
    //
    // Two things prevent it and both must stay: the string ends AT THE HANDS
    // and never touches the head or neck, and the body is bent and active in
    // every single frame. "Dangling" and "hanging" are banned words here —
    // they are accurate about the physics and catastrophic about the picture.
    subject:
      'a delighted small child in dungarees flying through the air, GRIPPING the string of a big ' +
      'pink helium balloon TIGHTLY IN BOTH RAISED HANDS above their head. The string ends AT THE ' +
      "CHILD'S HANDS and must NEVER touch or attach to their head, neck, face or back. Both arms " +
      'are stretched up holding on. Knees pulled up and legs kicking cheerfully. Laughing, having ' +
      'enormous fun, like a child on a rope swing. Silhouette: a balloon, a string, then a child ' +
      'holding on by both hands with bent kicking legs.',
    cycle:
      'a lively kicking float — the child is holding on and having fun, and is NEVER limp. In all ' +
      'four frames BOTH HANDS grip the string above the head and the arms stay raised. Frame 1: ' +
      'both knees tucked right up to the chest. Frame 2: legs kicked out forward, body leaning ' +
      'back. Frame 3: legs swung back behind, body leaning forward. Frame 4: legs apart mid-kick, ' +
      'one up and one down. NEVER draw the body hanging straight down, NEVER draw the arms at the ' +
      "sides, and NEVER attach the string to the child's head or neck.",
  },
  {
    id: 'puffy',
    aspect: '1:1',
    subject:
      'a child in an enormous puffy quilted blue winter coat walking to the LEFT, so padded they ' +
      'look almost round, tiny head poking out of the top, wearing a woolly hat with a big ' +
      'cream POM-POM on it. Silhouette: a big soft ball.',
    // The coat hides the legs, so there is almost nothing for a walk to move —
    // and the first version came back as one drawing tilted a few degrees four
    // times. The motion therefore has to be made big and put somewhere visible:
    // an exaggerated whole-body tip, a boot that clearly leaves the floor, and
    // a pom-pom that swings, which is a bright dot against a dark coat and so
    // is the one part of this character still readable at thirty pixels.
    cycle:
      'a heavy waddle — too padded to bend at the waist, so the WHOLE BODY tips right over from ' +
      'one boot to the other. The tip must be LARGE and unmistakable, at least 20 degrees, not a ' +
      'slight lean. Frame 1: tipped hard over onto the NEAR boot, the FAR boot lifted clear off ' +
      'the ground behind, the pom-pom flung backwards. Frame 2: bolt upright and level, both ' +
      'boots flat on the ground, body at its tallest, pom-pom straight up. Frame 3: tipped hard ' +
      'the OTHER way onto the FAR boot, the NEAR boot lifted clear off the ground in front, the ' +
      'pom-pom flung forwards. Frame 4: bolt upright and level again, both boots down. ' +
      'A different boot is off the ground in frame 1 than in frame 3. The arms stay stuck out ' +
      'sideways by the padding throughout.',
  },
  {
    id: 'slider',
    aspect: '1:1',
    subject:
      'a laughing child in stripey socks sliding along the floor on their front, arms forward, ' +
      'moving fast to the LEFT, with little speed lines behind. Silhouette: horizontal, low, unlike ' +
      'every other child in the set who is upright.',
    cycle:
      'a belly slide, horizontal in all four frames — this child never stands up. Frame 1: both ' +
      'legs kicked wide apart behind. Frame 2: legs together and trailing straight. Frame 3: legs ' +
      'kicked wide apart again, the other one leading. Frame 4: legs together, arms stretched ' +
      'furthest forward. The body stays low and flat to the floor throughout.',
  },
  {
    id: 'wagon',
    aspect: '1:1',
    subject:
      'a happy child riding in a little red toy wagon rolling to the LEFT, with a cardboard box lid ' +
      'held up in front of them like a shield. The wagon has a pull-handle and exactly TWO visible ' +
      'wheels of the same design in every frame. Nothing trails behind it: no rope, no string, no ' +
      'line on the floor. Silhouette: wide, with two round wheels.',
    cycle:
      'a roll over carpet — wheels, not steps. The wheel spokes are rotated a quarter turn further ' +
      'in each successive frame. Frame 1: the wagon level. Frame 2: the front wheel up on a bump, ' +
      'nose tipped up, the child jolted upward. Frame 3: the wagon level again. Frame 4: the back ' +
      'wheel up on a bump, nose tipped down. The cardboard shield stays held out front throughout.',
  },
  {
    id: 'bigkid',
    aspect: '1:1',
    subject:
      'a big grinning older child, much larger than the others, striding to the LEFT with both arms ' +
      'flung wide open for an enormous hug, a plush toy tucked under one arm. Friendly and boisterous, ' +
      'never scary. Silhouette: tall and very wide.',
    cycle:
      'a slow heavy stride. Frame 1: the NEAR leg planted far forward, the whole body dropped low ' +
      'onto it, landing hard. Frame 2: pushing off, legs passing, body at its highest. Frame 3: ' +
      'THE OPPOSITE OF FRAME 1 — the FAR leg planted far forward, body dropped low, landing hard. ' +
      'Frame 4: pushing off, legs passing, body at its highest. ' +
      'Both arms stay flung wide open for a hug in every frame. He carries a small green plush ' +
      'bunny tucked under the SAME arm — the one NEAREST the viewer — in ALL FOUR frames, in the ' +
      'same spot and at the same size. The bunny must never swap arms, move, or vanish.',
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
 * Walk cycles: one 2x2 sheet per character that has a `cycle`.
 *
 * ### Why a sheet and not four separate calls
 *
 * Four calls give you four slightly different children. Image models hold a
 * character consistent WITHIN one image far better than across several, so the
 * whole cycle is asked for as a single picture divided into quadrants, and the
 * loader slices it. One billed call per character, and all four poses come out
 * of the same act of drawing.
 *
 * ### Why 2x2 and not a 1x4 strip
 *
 * A strip needs a 4:1 aspect ratio, which is not in the API's supported list,
 * and squeezing four frames into 16:9 leaves each one about 400px wide against
 * 1000 tall — the model then draws four tiny figures with enormous margins. A
 * square divided into quadrants keeps each frame square, which is the shape
 * every other piece in this set is already drawn at.
 *
 * ### What still has to be fixed at load time
 *
 * Registration. Even in one image the model will not put all four figures at
 * exactly the same size or height in their cells, and a walk cycle whose feet
 * jump around is worse than no cycle at all. `sliceSheet` in
 * `src/render/sprites.ts` trims each frame to its own contents and aligns them
 * on a shared floor line. Do not try to solve that here by asking harder — it
 * is a measurement problem and the loader can measure.
 */
const SHEET_RULES = [
  'A SPRITE SHEET containing EXACTLY FOUR drawings of the SAME single character,',
  'arranged in a 2x2 grid: two frames on the top row, two on the bottom row,',
  'read left-to-right then top-to-bottom as frames 1, 2, 3 and 4 of one looping cycle.',
  'The character is IDENTICAL in all four frames — same size, same colours, same clothes,',
  'same side-on camera. ONLY THE POSE CHANGES between frames.',
  'Centre each figure in its own quadrant with its feet at the same height in all four.',
  'All four poses must be DIFFERENT from each other. In particular frame 3 must not repeat frame 1',
  'and frame 4 must not repeat frame 2: where a pose leads with one limb, its opposite frame leads',
  'with the other. A walking figure must use BOTH legs across the cycle, not the same leg twice.',
  // Do NOT reintroduce a "shade the far limbs darker" rule here. It is correct
  // animation practice and it made things worse: asked for it, the model started
  // recolouring rather than shading — a bare arm went orange, a pink top washed
  // out to skin tone, and one frame's hair came back a different colour, which
  // is the exact per-frame drift the single-image approach exists to avoid.
  'The clothing and hair colours are FIXED: use exactly the colours named in the character',
  'description, identical in all four frames. Never change a colour between frames.',
  // Whole-outfit consistency was not enough. The crawler's romper kept its
  // green in every frame while a large cream patch appeared over one leg in two
  // of them and vanished in the other two — read as "its pant leg changing as
  // it cycles". The rule has to reach individual garment PARTS.
  'This applies to every PART of the outfit separately: a sleeve, a trouser leg, a collar, a patch',
  'or a panel keeps its own colour in all four frames. Do not add or remove patches, panels, trim,',
  'pockets or details between frames — the four figures wear the identical outfit, only posed',
  'differently.',
  // The wagon came back with a wandering line on the floor in two frames, drawn
  // in a green near enough the key colour to be a hazard for the cut-out too.
  'Draw NOTHING except the character and whatever they are carrying: no ground line, no floor,',
  'no shadow, no motion trail, no dust, no speed lines, no stray marks of any kind.',
  // Props drift, and a drifting prop is worse than no prop. The Big Kid's plush
  // toy came back in frames 1 and 3 only, under a different arm in each and
  // absent from the other two, so in play it blinked on, off, and swapped sides.
  'Any object the character is holding or carrying appears in ALL FOUR frames, on the SAME side,',
  'under or in the SAME hand, at the same size. It must never swap sides, move, or disappear.',
  'No grid lines, no boxes, no borders, no frame numbers, no dividing lines of any kind:',
  'one single continuous flat #00FF00 background behind and between all four figures.',
].join(' ');

/**
 * ABANDONED: telling the two legs apart. Read this before trying again.
 *
 * A side-on walk cycle whose legs are the same colour at the same depth reads,
 * at thirty pixels tall, as ONE leg scissoring open and shut — "the girl
 * running looks like she is only running with one leg." The poses do alternate;
 * it is a failure of contrast, not of posing, and it survived two rounds of
 * fixing the poses.
 *
 * Two fixes were tried and BOTH made the sheet worse overall:
 *
 *  1. **Shade the far limb darker**, which is the textbook answer. The model
 *     recoloured instead of shading: a pink top washed out to skin tone, a bare
 *     arm went orange, and one frame's hair came back a different colour.
 *  2. **Mismatched shoes**, on the theory that an object is more robust than a
 *     tone. It gave the toddler matching shoes that changed colour BETWEEN
 *     frames — a strobe, which is worse than the thing it fixed — and made him
 *     bald into the bargain. On the Big Kid the shoe colours drifted the same
 *     way.
 *
 * The pattern in both failures is the same: any instruction phrased as "make
 * this part of the character look different from that part" gets read as
 * licence to vary the character, which is exactly what the single-image sheet
 * exists to prevent. Per-frame consistency and intra-frame contrast are pulling
 * against each other, and consistency is the one worth keeping.
 *
 * So it is left as it is. At the size these are drawn the alternation is weak
 * but the character is stable, which is the better of the two failures. If you
 * want to try again, do it somewhere the model cannot express it as colour
 * variation — different leg GEOMETRY, say a child in wellingtons where only the
 * near boot is drawn with a turned-up cuff.
 */

/**
 * Sheets are drawn facing RIGHT and mirrored at load. Everything else in this
 * file faces the way it is meant to face; this is the one exception, and it is
 * deliberate rather than an oversight.
 *
 * The kids walk left, so the first run of sheets asked for left. All ten came
 * back facing right. Asked again with the direction pulled out of the style
 * block, described physically ("nose and hands point LEFT, the back of the head
 * is on the RIGHT") and moved to the very end of the prompt where nothing
 * follows it — still right. The pose text is unavoidably full of "left leg" and
 * "right leg", and the direction drowns in it every time.
 *
 * So: ask for the direction the model is going to draw anyway, and flip the
 * frames in the loader. The request and the correction now point the same way,
 * which makes it deterministic instead of a coin toss — and a mirrored drawing
 * of a child is just a drawing of a child. The single-subject pieces above are
 * left alone; they have no pose text to drown in and they obey.
 */
const FACING_RIGHT = [
  'DIRECTION, most important of all: every figure must FACE RIGHT, moving towards the RIGHT EDGE',
  'of the picture. Their nose, face and outstretched hands point RIGHT; the back of their head is',
  'on the LEFT. All four frames face the same way.',
].join(' ');

const WALK_SHEETS = BASE_PIECES.filter((piece) => piece.cycle).map((piece) => ({
  // The id the renderer looks up: `crawler.walk`, alongside the still `crawler`.
  id: `${piece.id}.walk`,
  aspect: '1:1',
  // Four frames in one image, so 1K gives each frame 512 — the same resolution
  // every other sprite gets. 512 here would be 256 a frame, visibly softer.
  size: '1K',
  // `mirrored` is why the game gets left-facing kids out of right-facing art.
  sheet: { cols: 2, rows: 2, align: piece.align ?? 'floor', mirrored: true },
  subject: piece.subject,
  poses: piece.cycle,
}));

export const PIECES = [...BASE_PIECES, ...WALK_SHEETS];

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
  if (piece.sheet) {
    return `${KEY_BACKGROUND} ${SHEET_RULES} The character: ${piece.subject} The four poses: ${piece.poses} ${DRAW_STYLE}, clean crisp edges suitable for cutting out against pure green #00FF00. ${FACING_RIGHT}`;
  }
  if (piece.background === 'none') {
    return `${piece.subject} ${DRAW_STYLE}. This is a full-bleed background image: it must fill the entire frame edge to edge, with no border and no chroma-key colour anywhere.`;
  }
  return `${KEY_BACKGROUND} Subject: ${piece.subject} A single centred subject filling most of the frame. ${DRAW_STYLE}, clean crisp edges suitable for cutting out against pure green #00FF00.`;
}
