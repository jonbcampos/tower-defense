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
 * ## Why every kid has an explicit `outfit`
 *
 * A character now has more than one sheet — a walk and a grab — and the model
 * picks clothes freely from a description that does not name them. It picked
 * differently each time, so the toddler wore dusty rose shorts while walking
 * and light blue ones while pulling a toy apart, and changed clothes the
 * instant she stopped. Naming the outfit is what keeps one kid one kid across
 * every sheet she appears in. Add the field before adding a third animation.
 *
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

  {
    // The player, sitting in the nook beside her unicorn.
    //
    // She is on the LEFT with the unicorn and the guard bears, not among the
    // kids walking in from the right, and that is the whole point of her. The
    // kids are what you drive away with bubbles; putting her among them would
    // make the game about repelling her. Here she is the one being protected
    // and doing the protecting, which is the answer to "where am I?"
    //
    // A cartoon character, not a portrait. The description is a handful of
    // traits — hair, skin, a coral sundress — drawn in the same picture-book
    // style as everything else, so she belongs to this cast rather than being
    // a photograph pasted into it.
    id: 'ellie',
    aspect: '1:1',
    size: '1K',
    // Four of her in one image rather than four calls, for the same reason the
    // walk cycles are one image: the model holds a character together within a
    // picture far better than across separate ones, and four slightly different
    // girls would be much worse than four expressions of one.
    sheet: { cols: 2, rows: 2, align: 'center' },
    subject:
      'a little girl about five years old sitting cross-legged on the floor facing the viewer, ' +
      'long wavy dark brown hair past her shoulders, warm honey-tan skin, big brown eyes, ' +
      'a bright coral-pink sleeveless sundress with white trim at the neck and hem. ' +
      'Silhouette: a seated child, wider at the bottom where the dress spreads on the floor.',
    // POSTURE carries these, not eyebrows. She is drawn about forty pixels tall,
    // where a face is a handful of pixels and a mouth shape is nearly invisible,
    // but "arms up" versus "knees hugged" reads instantly at any size.
    faces:
      'the same girl in four moods, told apart by her WHOLE BODY and not only her face. ' +
      'Frame 1, happy and relaxed: sitting comfortably, big smile, one arm raised in a friendly ' +
      'wave. Frame 2, a little worried: sitting up straighter, both hands together in her lap, ' +
      'small uncertain mouth, eyebrows raised, glancing sideways. Frame 3, frightened: knees ' +
      'pulled right up to her chest and hugged tightly with both arms, shoulders hunched up, eyes ' +
      'wide, a small worried frown — curled up small. Frame 4, delighted: BOTH arms thrown high ' +
      'in the air above her head, eyes squeezed shut with joy, an enormous open grin, cheering.',
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
    id: 'fan',
    aspect: '1:1',
    subject:
      'a small round desk fan on a stubby base, pale blue, facing RIGHT, with a white grille and ' +
      'three visible blades behind it, and two or three soft curved motion lines blowing off to ' +
      'the right. Silhouette: a circle on a small stand.',
  },
  {
    id: 'ring',
    aspect: '1:1',
    subject:
      'a yellow inflatable duck swim ring lying FLAT on the water, seen from a low three-quarter ' +
      'angle so the hole in the middle is clearly visible as an oval. A duck head with an orange ' +
      'beak rises at one end. It must read as something you could stand a toy on top of, not as a ' +
      'hoop standing on its edge. Silhouette: a wide flat oval with a small head at one side.',
  },
  {
    id: 'castle',
    aspect: '1:1',
    subject:
      'a small sandcastle of damp golden sand: a low wall with three squat towers on top, each ' +
      'tower with square crenellations, and a tiny paper flag on the middle one. Solid and heavy ' +
      'looking. Silhouette: a wide flat block with three bumps. No face, no character.',
  },
  {
    id: 'slushie',
    aspect: '1:1',
    subject:
      'a paper cup of bright blue crushed-ice slushie with a domed frozen top spilling over the ' +
      'rim, a candy-striped straw poking out, and frost on the outside of the cup. ' +
      'Silhouette: a tapered cup with a dome on top and a straw. Icy blue and white.',
  },
  {
    id: 'beachball',
    aspect: '1:1',
    subject:
      'a classic inflatable beach ball with wide alternating panels of pink, cream and mint, a ' +
      'glossy highlight on the upper left, resting on the ground. ' +
      'Silhouette: a plain circle — the only perfectly round object in the set.',
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
    look: 'light golden-brown skin and soft dark brown hair',
    outfit: 'a plain sage-green one-piece romper and small tan boots',
    grab: 'tugging at a toy while still down on hands and knees. Frame 1: reaching out with one hand and pulling, arm stretched. Frame 2: rocked back on her knees, both hands gripping, hauling towards herself. Frame 3: reaching out with the OTHER hand and pulling. Frame 4: rocked back again, hauling. She never stands up and never leaves the ground.',
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
    look: 'warm honey-brown skin and dark brown hair — a Hispanic toddler',
    outfit: 'a plain orange short-sleeved t-shirt, dusty rose shorts and mint-green shoes',
    grab: 'pulling something apart with both hands. Frame 1: arms stretched right out, leaning forward, just grabbing hold. Frame 2: leaning back hard with both elbows bent, hauling it towards himself. Frame 3: arms out again, leaning forward, having lost his grip. Frame 4: leaning back hauling, one foot lifted with the effort.',
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
    look: 'deep brown skin and black hair worn in two big afro puffs',
    outfit: 'a dusty pink sleeveless top, mauve-purple shorts, white socks and mint-green trainers',
    grab: 'skidded to a stop and yanking at something. Frame 1: braced with both feet planted wide, arms out, grabbing. Frame 2: leaning right back, both arms bent, pulling hard. Frame 3: braced and grabbing again, other foot forward. Frame 4: leaning back pulling, hair flying with the effort.',
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
    look: 'fair skin and auburn hair, mostly hidden by the hood',
    outfit: 'a bright yellow hooded raincoat, grey leggings and yellow wellington boots',
    grab: 'pulling at something in her shiny coat. Frame 1: both arms out of the sleeves and stretched forward, gripping. Frame 2: leaning back, hood tipping, hauling it towards her. Frame 3: arms forward again, coat swinging. Frame 4: leaning back hauling, one welly boot lifted. The hood stays UP and pointed in all four.',
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
    look: 'medium brown skin on the bare feet that show under the hem',
    outfit: 'a plain lilac blanket draped over her, and nothing else visible but bare feet',
    grab: 'a mound under a blanket, wrestling with something. Frame 1: the mound leaning forward, two small hands poking out of the front of the blanket and gripping. Frame 2: the mound rocked back, hauling, the blanket stretched taut. Frame 3: leaning forward again. Frame 4: rocked back hauling, one bare foot showing. Still no face in any frame.',
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
    look: 'warm tan skin and straight black hair',
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
    look: 'deep brown skin and black hair, only a little face showing',
    outfit: 'an enormous periwinkle-blue quilted puffer coat, a lilac and cream woolly hat with a big cream pom-pom, and tan boots',
    // NO LEAN in these frames, on purpose, and do not put one back.
    //
    // A waddle is a side-to-side roll, and asking for one cost two generations:
    // told to tip "the other way" in frame 3, the model mirrored the whole
    // character instead, so she span round halfway through her own cycle. Being
    // told explicitly not to turn around did not help — an opposite lean and a
    // mirror are apparently the same idea to it.
    //
    // So the frames carry only what the model is reliable at — which boot is
    // off the ground, and how tall she is — and the roll is applied as a
    // rotation in `settleFrame`, which cannot flip anything. See ROLLED_BY_HAND
    // in src/render/kids.ts; the two halves only work together.
    grab: 'too padded to bend, shoving at something with both stiff arms. Frame 1: both padded arms straight out, pushing. Frame 2: whole body leaned in behind the push, boots braced. Frame 3: arms out again, rocked back slightly. Frame 4: leaning in hard, the pom-pom flung forward. She stays BOLT UPRIGHT in all four: no leaning sideways, no tipping.',
    cycle:
      'a heavy plod, too padded to bend at the waist. She stands BOLT UPRIGHT and PERFECTLY ' +
      'VERTICAL in all four frames — no leaning, no tipping, no tilting whatsoever, in any frame. ' +
      'The only things that change are which boot is off the ground and how high she rides. ' +
      'Frame 1: upright, the FAR boot lifted clear off the ground behind her, body at its lowest. ' +
      'Frame 2: upright, both boots flat on the ground, body at its tallest. Frame 3: upright, ' +
      'the NEAR boot lifted clear off the ground in front, body at its lowest. Frame 4: upright, ' +
      'both boots flat on the ground, body at its tallest. A different boot is off the ground in ' +
      'frame 1 than in frame 3. The arms stay stuck out sideways by the padding throughout, and ' +
      'the pom-pom hat sits straight on her head in every frame.',
  },
  {
    id: 'slider',
    aspect: '1:1',
    subject:
      'a laughing child in stripey socks sliding along the floor on their front, arms forward, ' +
      'moving fast to the LEFT, with little speed lines behind. Silhouette: horizontal, low, unlike ' +
      'every other child in the set who is upright.',
    look: 'fair freckled skin and ginger hair',
    outfit: 'a mint-green t-shirt, purple shorts and pink-and-white striped socks',
    grab: 'still flat on her front, hauling at something with both arms. Frame 1: both arms stretched forward, hands gripping. Frame 2: elbows bent, pulling it under her chin. Frame 3: arms stretched forward again. Frame 4: elbows bent pulling, socked feet kicking up behind. Horizontal and low to the floor in every frame.',
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
    look: 'warm honey-brown skin and dark curly hair — a Hispanic child',
    outfit: 'a cream hooded top, dusty pink trousers and grey shoes, riding a red wagon with cream wheels',
    grab: 'still sitting in her wagon, leaning out to whack at something with the cardboard shield. Frame 1: shield raised high above her head. Frame 2: shield swung down and forward. Frame 3: shield raised high again. Frame 4: shield swung down. The wagon stays level and both wheels stay on the ground.',
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
    look: 'medium brown skin and dark curly hair',
    outfit: 'a dusty purple long-sleeved top over a cream t-shirt, pale pink trousers and grey shoes',
    grab: 'a big child pulling a toy apart with both hands. Frame 1: both arms stretched right out, grabbing hold. Frame 2: leaning back with all his weight, elbows bent, hauling. Frame 3: arms out again. Frame 4: leaning back hauling, one foot off the ground. The green plush bunny stays tucked under the SAME arm, the one nearest the viewer, in all four frames.',
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
    // World 2's board. Same job and same rules as `room` below — flat,
    // orthographic, quiet — because the reason that one is composed the way it
    // is has nothing to do with it being indoors. A backyard drawn in charming
    // perspective would be exactly as unplayable as the bedroom was.
    id: 'yard',
    aspect: '16:9',
    background: 'none',
    size: '2K',
    subject:
      'A FLAT ORTHOGRAPHIC GAME BACKGROUND with NO PERSPECTIVE and NO VANISHING POINT. ' +
      'The TOP ONE SIXTH of the image is a wooden garden fence of vertical planks with a soft ' +
      'sunny sky and a few leafy branches showing above it. The REMAINING FIVE SIXTHS below it is ' +
      'plain, even, slightly textured green lawn, flat and uniform, filling the whole width. ' +
      'Straight-on and perfectly horizontal: no ceiling, no side walls, no corners, no horizon ' +
      'line, no furniture, no toys, no people, no paddling pool, no flowerbeds, no path. ' +
      'Rich and slightly deep in colour so that pale characters placed on top of it stand out. ' +
      'Warm afternoon light, soft and even, no hotspots and no cast shadows.',
  },
  {
    // World 3's board. Same flat-orthographic rules as the other two — see the
    // note on `room`. The steam is drawn by the game on top of this, so the
    // picture itself must be CLEAR: a backdrop that already looks foggy would
    // make the fogged half indistinguishable from the clear half.
    id: 'bath',
    aspect: '16:9',
    background: 'none',
    size: '2K',
    // NO TILED FLOOR. The first version had one and it came back in perspective
    // — a converging grid of floor tiles, which is the exact thing the bedroom's
    // prompt was rewritten to avoid, and it fought the flat five-lane grid
    // badly enough that the board stopped reading as a board.
    //
    // The lesson generalises to every world after this: a floor with a REGULAR
    // PATTERN on it will always be drawn receding, because that is what a
    // patterned floor looks like in every reference the model has. The floor
    // must be plain. The room is identified by its WALL, which is at the top of
    // the frame where perspective cannot hurt anything.
    subject:
      'A FLAT ORTHOGRAPHIC GAME BACKGROUND with NO PERSPECTIVE and NO VANISHING POINT. ' +
      'ONLY THE TOP ONE SIXTH of the image is wall: a band of small square mint-green bathroom ' +
      'tiles with a row of darker teal trim tiles along its bottom edge. That band must be thin — ' +
      'it fills the top sixth and no more. ' +
      'ALL of the REMAINING FIVE SIXTHS is a PLAIN, EVEN, UNTILED floor of soft muted teal-grey, ' +
      'flat and uniform, filling the whole width, with only a faint mottled texture. ' +
      'The floor has NO TILES, NO GRID, NO SQUARES, NO GROUT LINES and NO PATTERN of any kind — ' +
      'it is one continuous colour, like smooth vinyl. Do not draw any lines on the floor. ' +
      'THE PICTURE IS COMPLETELY EMPTY except for the wall band and the floor. ' +
      'ABSOLUTELY NO PEOPLE: no child, no girl, no boy, no adult, no figure, no character of any ' +
      'kind anywhere in the image. It is an empty room with nobody in it. ' +
      'Also no ceiling, no side walls, no corners, no horizon, no bath, no sink, no toilet, no ' +
      'towels, no mat, no furniture, no objects, no plants and no decorations. ' +
      'CLEAR AND CRISP with no steam, no mist and no fog anywhere — the game draws its own steam ' +
      'on top and needs the picture underneath to be clear. ' +
      'The floor must be deep enough in tone that pale characters placed on it stand out. ' +
      'Soft even lighting, no hotspots, no reflections, no cast shadows.',
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
/**
 * The grid rules, parameterised by shape.
 *
 * Says the same things `SHEET_RULES` used to — identical character, no grid
 * lines, no mirroring, consistent colours — plus the one new demand that
 * matters: the two rows are the same child doing two different things, not two
 * children. That sentence is the entire reason this piece exists.
 */
const MOTION_RULES = (grid, rowCount) =>
  [
    `A SPRITE SHEET laid out as a grid of ${grid}, containing`,
    rowCount > 1
      ? 'EIGHT drawings of the SAME single character: the top row is one action and the bottom row is a DIFFERENT action by THE SAME child.'
      : 'FOUR drawings of the SAME single character.',
    'Read each row left to right.',
    'The character is IDENTICAL in every single cell — same face, same hair, same height, same',
    'build, same clothes, same colours, same side-on camera. Across the rows as well as along',
    'them: it must be impossible to tell that the two rows were drawn separately, because they',
    'were not. ONLY THE POSE CHANGES from cell to cell.',
    ...SHEET_COMMON,
  ].join(' ');

const SHEET_COMMON = [
  'Centre each figure in its own cell, with its feet at the same height in every cell of a row.',
  'All four poses must be DIFFERENT from each other. In particular frame 3 must not repeat frame 1',
  'and frame 4 must not repeat frame 2: where a pose leads with one limb, its opposite frame leads',
  'with the other. A walking figure must use BOTH legs across the cycle, not the same leg twice.',
  // "Frame 3 tips the OTHER way" was read as "frame 3 faces the other way", so
  // the puffy coat kid span round halfway through her waddle. Describing a pose
  // as the reverse of another one needs this said next to it.
  'NEVER mirror, flip or turn the character around between frames. All four face the same way.',
  'When a pose is described as the reverse of another, only the LEAN or the LIMBS reverse — the',
  'body still faces the same direction, and the head, face and any hat stay on the same side.',
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
  'SKIN TONE and HAIR COLOUR are part of this and must be identical in all four frames.',
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

/**
 * A grid of expressions rather than a grid of walk poses.
 *
 * Shares the slicer with the walk sheets and almost nothing else: there is no
 * cycle, no facing to enforce, and the frames are chosen by game state rather
 * than played in order. Bending SHEET_RULES to cover both would mean a prompt
 * full of instructions about legs for a character who is sitting down.
 */
const FACE_SHEET_RULES = [
  'FOUR drawings of the SAME single character arranged in a 2x2 grid, two on the top row and two',
  'on the bottom, read left-to-right then top-to-bottom as moods 1, 2, 3 and 4.',
  'The character is IDENTICAL in all four — same face, same hair, same clothes, same colours,',
  'same size, seen from the same angle, facing the viewer. ONLY HER EXPRESSION AND POSE CHANGE.',
  'Centre each figure in its own quadrant. No grid lines, no boxes, no borders, no frame numbers:',
  'one single continuous flat #00FF00 background behind and between all four figures.',
  'Nothing else in the picture: no floor, no shadow, no furniture, no props.',
].join(' ');

/**
 * One sheet per kid holding BOTH cycles: walking on the top row, grabbing on
 * the bottom.
 *
 * This replaced two separate sheets, and the reason is the most expensive
 * lesson in this file. A walk sheet and a grab sheet drawn by two calls are two
 * different children, however carefully the description is pinned. First the
 * outfits drifted, so the outfit was written down; then the same toddler came
 * back bare-legged in one and in shorts in the other; then the runner changed
 * hairstyle. Every fix corrected that detail and moved the drift somewhere
 * else, because the model holds a character together WITHIN an image and simply
 * does not across two.
 *
 * 4x2 on a 16:9 frame gives eight cells of roughly 690x770 — near enough square
 * that each frame gets the same treatment a 2x2 cell used to. `rowIds` tells the
 * loader to publish the rows as `<kid>.walk` and `<kid>.grab`, so nothing
 * downstream changed: the renderer still asks for exactly those two ids.
 *
 * A kid with no `grab` gets a walk-only 1x4. The Balloon Kid never stops, and
 * four frames of her pulling at nothing would be four wasted cells and one
 * baffling glossary entry.
 */
const MOTION_SHEETS = BASE_PIECES.filter((piece) => piece.cycle).map((piece) => {
  const both = Boolean(piece.grab);
  return {
    id: `${piece.id}.motion`,
    aspect: both ? '16:9' : '1:1',
    size: '2K',
    sheet: {
      cols: 4,
      rows: both ? 2 : 1,
      align: piece.align ?? 'floor',
      mirrored: true,
      rowIds: both ? ['walk', 'grab'] : ['walk'],
    },
    subject: piece.subject,
    look: piece.look,
    outfit: piece.outfit,
    rows: both
      ? [
          { label: 'TOP ROW (frames 1 to 4), WALKING', poses: piece.cycle },
          { label: 'BOTTOM ROW (frames 5 to 8), PULLING A TOY APART', poses: piece.grab },
        ]
      : [{ label: 'frames 1 to 4', poses: piece.cycle }],
  };
});

export const PIECES = [...BASE_PIECES, ...MOTION_SHEETS];

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
/**
 * The child's own colouring, if the piece names one.
 *
 * Separate from `subject` so that the cast's variety is a list you can read
 * down in one place and check, rather than a detail buried in ten paragraphs.
 * The same values live on the `EnemyDef`s in `src/game/enemies.ts`, which is
 * what the hand-drawn fallback painters use, and the two are meant to agree.
 */
function look(piece) {
  const skin = piece.look ? ` Skin and hair: ${piece.look}.` : '';
  const kit = piece.outfit ? ` Outfit, exactly and in every frame: ${piece.outfit}.` : '';
  return `${skin}${kit}`;
}

export function promptFor(piece) {
  if (piece.faces) {
    return `${KEY_BACKGROUND} ${FACE_SHEET_RULES} The character: ${piece.subject} The four moods: ${piece.faces} ${DRAW_STYLE}, clean crisp edges suitable for cutting out against pure green #00FF00.`;
  }
  if (piece.rows) {
    const grid = `${piece.sheet.cols} columns by ${piece.sheet.rows} row${piece.sheet.rows > 1 ? 's' : ''}`;
    const rows = piece.rows
      .map((row) => `${row.label}: ${row.poses}`)
      .join(' ');
    return `${KEY_BACKGROUND} ${MOTION_RULES(grid, piece.sheet.rows)} The character: ${piece.subject}${look(piece)} ${rows} ${DRAW_STYLE}, clean crisp edges suitable for cutting out against pure green #00FF00. ${FACING_RIGHT}`;
  }
  if (piece.background === 'none') {
    return `${piece.subject} ${DRAW_STYLE}. This is a full-bleed background image: it must fill the entire frame edge to edge, with no border and no chroma-key colour anywhere.`;
  }
  return `${KEY_BACKGROUND} Subject: ${piece.subject}${look(piece)} A single centred subject filling most of the frame. ${DRAW_STYLE}, clean crisp edges suitable for cutting out against pure green #00FF00.`;
}
