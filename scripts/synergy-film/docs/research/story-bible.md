# SYNERGY: Story Bible for a 60-second wordless 3D film

Story editor's bible. It draws on the repo canon in /home/user/linkedin, the visual-canon measurements and the word-history research. Everything here is for a fully 3D-rendered film built from scratch in Python and Blender, with no text, no fonts, no generated sound, and only Synergy as the star.

---

## (a) Who Synergy is

Synergy is the deadpan robot who hosts every meeting at **LinkedIn Beats** (linkedinbeats.com), a satirical "corporate beats studio". His titles are Founder & Chief Alignment Officer, "Management", "Synergy | Leadership", Host, and Head of Professional Development Optimization. He also signs the Certificate of Professional Effort. All 14 of his meetings open with the same ritual, "Before we delve in, let's optimize...". Every real problem raised in them gets a lavish adjective ("Outstanding.", "Phenomenal.") and the same deferral: **"We'll take it offline."** He turns "I booked a meeting" into a thought-leadership post, admires the engagement and comments on it himself. Asked "When will it be ready?", he finds the honest answer "Friday" too measurable and sets up a working group that meets every Friday with no end date. When the office finally applauds him, he gives exactly one small head dip.

Physically he is battered ivory-and-chrome sheet metal: a faceted wedge-shaped head of riveted plates and a recessed black glass face. His only expression is two tiny square green pixel eyes and one fixed row of LEDs. He wears a call-centre headset and a lanyard, and he holds a white paper coffee cup at chest height that he never drinks from. He is never cute and never zany; the joke is how terribly seriously he takes the job.

He is named after a word that once meant something enormous: Greek *syn* + *ergon*, "working together"; Sherrington's muscles "co-operating for one effect"; Fuller's "behavior of whole systems unpredicted by the behavior of their parts". Business then wore the word smooth. **The film's secret is that his body is the word's original meaning**: dozens of flimsy triangular plates riveted into one rigid whole. Only his job is the buzzword.

---

## (b) Canonical lore beats, ranked by cinematic potential (wordless 3D)

The score weighs: does it read with zero words, can it be built in 3D, how well does it escalate, and how true is it to canon.

| # | Beat (canon source) | Wordless 3D translation | Score |
|---|---|---|---|
| 1 | **"We'll take it offline"**: the reflex deferral that closes every one of the 14 meetings (src/meeting-room/scripts.js). The merch sticker draws it as an **unplugged yellow audio jack** (src/store/products.js). | Problems arrive as physical objects, each tethered by a yellow cable. He praises each one (a tilt and a mouth sweep), unplugs it, and it drops away. Then **"Offline" becomes a real place**. | 10 |
| 2 | **Paperless + the printer**: he announces "a truly sustainable paperless future" while the printer feeds one sheet every 3.6 s onto a stack that only grows (paperless-0/1; printer-paper.js; the "Optimizing" film). | The printer is a built-in metronome: one sheet per bar, then escalation to towers, carts and an avalanche. The irony needs no words. | 9 |
| 3 | **The applause ceremony and the single head dip**: the office claps "with restrained, uncomfortably sincere corporate pride", a VHS camcorder documents it, and he answers with ONE dip and one blink. No cheers, no confetti (Welcome V5/V6). | The perfect closing button. Applause can be rendered with no humans on screen (see rule E7). | 9 |
| 4 | **The coffee cup held but never drunk** ("steadily at chest height... without lifting, lowering, drinking"). | A canon rule that becomes a payoff: break it **once**, deliberately. | 8 |
| 5 | **"I booked a meeting" inflation**: a tiny truth goes into ChatGPT and comes out as "a new era of alignment", with reactions climbing from 124 to 1,834 (Welcome V3/V4). Also the Academy dial, from Almost Human to Corporate Hallucination. | Scale gags: a small object grows monumental, or 3D glass reaction tokens fall like snow. The source is text-heavy, so it must be translated into objects. | 7 |
| 6 | **"Chief Alignment Officer"**: the banner crew level a banner with a spirit level and measure the gap between two identical banners (Welcome V1). | A spirit-level bubble settling dead centre: alignment as a literal, satisfying act. | 7 |
| 7 | **"Too measurable" leads to the working group**: Friday every week, no end date, 33 required attendees (Training 02). | A recursive hall of mirrors full of identical meetings. Calendars carry text, so build it with letterless grids. | 6 |
| 8 | **The paper droid, "a droid with a very important delivery"**, and the 9:03 motif ("At nine oh three, I clicked send" / "the paper arrived"). | A charming secondary mover that works in any spine. If 9:03 appears, a clock may show it with hands only. | 6 |
| 9 | **The Caffeinated Edition**: three or four cups on the desk and fast typing. | A cup count can act as a visual clock of escalation. | 5 |
| 10 | **Reflection in his glass face**: a loading window reflected in the screen (Learn to Speak LinkedIn). | A gorgeous macro shot, since glossy black glass reflects the world. | 5 |
| 11 | **"Quick sync. Why is everyone playing music?"**: he plays straight man to his own band. | Music-driven world, deadpan centre. Works best as a tone note. | 4 |
| 12 | **Synthia**: twin robot with a cream neckerchief who prints the paperless announcement "for every stakeholder. Plus spares." | Cheap to add (same rig plus a scarf), but she splits focus away from the mascot. Use her only in the paperless spine. | 4 |
| 13 | **The Report Is Attached**: 17 pages, the attachment limit, "a slightly smaller file". | A folder physically squeezed through pipes. Fun, but a side story. | 3 |

**Personality kernel** for every animator: serious, enthusiastic, restrained. He is a true believer who never resolves anything. He listens politely, praises everything and defers everything. He has a stiff protocol-droid body and is "almost imperceptibly sarcastic". He is quietly self-aware: the Academy's last tip, "The Program certifies fluency, not sincerity.", implies a robot who knows the game is hollow and plays it straight anyway. That self-awareness is the emotional crack the film can open, once.

---

## (c) Visual canon summary (modeling-relevant)

**Primary references:**
- `scratchpad/refs/video_synergy-v2-source_t3.png`: the approved plate, "yes very good version of synergy - NICE". All measurements below come from it.
- `refs/ref1_attached.png`: the user's photoreal reference.
- `refs/ref2_attached.png`: the user's stylized reference.
- `refs/head_closeup_v2source.png`, `eyes_macro_v2source.png`, `hand_cup_closeup_v2source.png`, `torso_closeup_v2source.png`.
- `fullbody_crop_team-master.png` and `legs_arms_closeup_team-master.png`: the only full-body source.

**Do-not-do references:**
- `refs/_superseded_v1/`: round head, caret eyes.
- `refs/_not_synergy/`: the stamp robot with a tie.

(All paths are under scripts/synergy-film/docs/ (was scratch) .)

**Scale and axes.** He stands 1.75 m to the head apex, about 5.3 head-heights tall, and is top-heavy and broad. In Blender he faces −Y, the character's left is +X, Z is up, and units are metres.

**Head.** An asymmetric faceted "cut-gem" wedge, W:H about 1.38, at 0.45 × 0.33 × 0.35 m after scaling by 0.95.
- **The wedge points to the character's RIGHT (viewer's left); the short steep side and the earcup are on the viewer's right.** Every reference agrees on this.
- Build it as a convex hull of 14 points, then dissolve_limit at 1°, which gives 23 facets. Head-local coordinates at scale 1.0, origin at chin level:
  - apex (0.065, 0.010, 0.345)
  - Rtip (−0.265, 0.030, 0.190)
  - L1 (0.210, 0.050, 0.225)
  - L2 (0.170, 0.020, 0.030)
  - chin (−0.015, −0.090, 0.000)
  - LR (−0.140, −0.040, 0.055)
  - face corners: BrowR (−0.109, −0.150, 0.212), BrowL (0.109, −0.150, 0.212), JawL (0.109, −0.158, 0.050), JawR (−0.109, −0.158, 0.050)
  - back: BK1 (0.020, 0.210, 0.270), BK2 (−0.120, 0.200, 0.140), BK3 (0.120, 0.190, 0.090), BK4 (−0.020, 0.150, 0.020)
- **Plates:**
  - Each facet becomes 1 to 3 separate plates: solidify 2.5 mm, bevel 1.5 mm, with 1–1.5 mm dark gaps between plates.
  - About 30% are **galvanized grey** plates, never touching each other and recessed 1.5 mm. The rest are **cream enamel**.
  - The underside is dark gunmetal, with a neck opening of r 0.045.
  - Key grey placements: a diagonal band on the big crown-wedge facet, a tall grey cheek panel hugging the screen's viewer-left edge, the viewer-right half of the chin, and the chin-left facet.
- **Rivets:** 120–150 on the head. Dome heads are 7–9 mm in diameter and 2.5 mm high, inset 8 mm, spaced 35–50 mm apart, with 10 mm rivets at the vertices. Many have rust rings.
- **Wear:** rust freckles at rivets, seams and lower edges; 2–4 cm rust bleed streaks; chipped cream edges showing bare steel; seam grime.
- **Pose:** the head is usually rolled 0–7° with the earcup side higher. Hero cameras sit level with the screen or slightly below it, 0–10° toward the character's right.

**Face screen.**
- One rounded rectangle, 0.190 × 0.135 m with 6 mm corner radius, recessed 5 mm behind a 12 mm cream bezel lip with rivets and rust specks.
- The glass is #0E100C black-olive, gloss roughness 0.05–0.1, and reflects the fluorescents.
- The LED matrix is 22 × 16 cells at 8.4 mm pitch, each lit square 6.8 mm. Unlit cells are #0A140C at 2–4%. Lit cells are **#4AFF70** at emission 8–15 plus bloom, with cores clipping toward #A8FFC0.
- **Neutral eyes: 2 wide × 3 tall** at columns 5–6 and 15–16, rows 5–7. They sit high, at 27% and 73% of screen width.
- **Mouth:** ONE row of 22 small LEDs (3.4 × 6.8 mm, 4.5 mm pitch) about 80% of the way down the screen, spanning 55% of its width.
  - Idle brightness is 11%.
  - "Speaking" is a brightness wave travelling left to right at about 15 LEDs/s with a 7-LED falloff. Strength is max(0.16, (1 − d/7) × level).
  - **The height never changes.**
- **Blink:** the eyes collapse to one row, then switch off for 2–3 frames.
- **Hero "instructor" register:** 3 × 3 eyes, a 4-px brow over each with the viewer-right brow raised one row, and a 4-px mouth with one raised corner pixel. Use it at most twice in the film.

**Headset** (black, parented to the head).
- **Left earcup:** centred at (0.228, −0.005, 0.118), Ø 0.115, 0.05 deep. Leatherette cushion ring, a matte black shell #161616 with a concentric raised ring, and a thin dark-brass rim #7A6247. A U-yoke and slider block connect it to the band.
- **Right earcup:** mostly hidden behind the wedge.
- **Headband:** 26 × 12 mm, passing 1–2 cm behind the apex and tilted back about 15°.
- **Boom mic:** a 6–7 mm rod curving from the left cup's lower front to a foam capsule (about 65 × 30 mm) just below the screen's right half, a few cm in front of the chin.
- **Cord:** 4 mm, dropping down the left side of the neck into the collar.

**Neck** (exposed, about 0.10–0.13 m).
- A stack of 6–7 dark-bronze vertebra discs on a chrome core.
- **Two chrome pistons in an A-frame** rising from the collar's front corners to just under the head.
- Black, copper and red cables, plus brass gears visible in the collar cavity.

**Torso.**
- A wide faceted barrel breastplate of triangular cream and grey plates (Z 1.32 to 0.99): 0.56 m wide at the top, tapering to 0.36. The vertex grid is in the visual-canon packet.
- The largest grey panel sits under the chip.
- **Blue paint chip:** #1F5FA8, about 6 × 3.5 cm, a ragged flake on the character's left upper chest just right of the lanyard strap (viewer's right).
- **Exposed waist:** steel spine, bronze discs, chrome pistons, and red, orange, copper and black wiring.
- **Pelvis:** faceted cream plate with dark hip hubs.

**Arms and hands.**
- **Shoulders:** faceted cream pauldrons with one grey lower facet.
- **Upper arms:** gunmetal bone bars with twin chrome pistons and cable bundles.
- **Elbows:** dark hubs.
- **Forearms:** 8-sided cream shells with a grey top inlay, a dark vent slot and a black wrist band.
- **Hands:** a gunmetal palm with a cream back plate and black knuckle hubs.
- **Fingers: four, each with three CREAM segments separated by BLACK joint bands, ending in a BRONZE tip cap (#6E4F33).** This is the most recognisable hand detail.
- The thumb has two segments.
- Every joint is a simple hinge.

**Legs.** Faceted cream thigh and shin shells with grey inserts, chrome rods at the back, kneecap plates, and faceted wedge feet with dark soles.

**Props.**
- **Cup:** a plain white paper cup (#F2F0EB) with no sleeve or logo, 0.115 m tall, 0.090 m across at the top. White lid with a sip spout. Held in his **RIGHT hand (viewer's left)** at chest height, fingers wrapped round it and the thumb behind.
- **Lanyard:** black strap in a V from the collar to about Z 1.10, with a chrome J-hook.
- **Badge:** in a clear vinyl sleeve at chest centre, Z ≈ 1.04. **The card is BLANK** (see E1).

**Character palette.**

| Element | Colour |
|---|---|
| Cream enamel | #E3D2B4 (highlight #F2E4CB) |
| Grey panels | #8C877F |
| Underside | #3A3631 |
| Internals | #2E2B28 |
| Chrome | #D0D2D4 |
| Bronze discs | #6B5236 |
| Copper / red wire | #B87333 / #9E2A1E |
| Rust | #8F4A1F / #4F2E17 |
| Glass | #0E100C |
| LED | #4AFF70 |
| Chip | #1F5FA8 |
| Headset | #161616 |
| Cup | #F2F0EB |
| Fingertips | #6E4F33 |

**World palette** (site canon): cobalt #0757ec, warm ivory #fbf6e8, paper #fbf9f0, butter #fff7d9, Synergy yellow #ffe16b, sky #9cc8f4, navy carpet, beige cubicles and fluorescent white. Use orange #ff8a48 only sparingly.

**Supporting non-human cast (allowed on screen):**
- **Printer:** beige 1990s desktop laser printer with a pulsing lime LED. Sheets only ever move outward onto a stack that only grows.
- **Paper droid:** a knee-high ivory canister with a silver dome, an offset dark visor, a cobalt collar band and a cyan status light. It tows a steel paper trolley on a rigid tow bar. It never gets limbs or a face.
- **Synthia:** Synergy's rig plus a cream neckerchief.

**Motion canon.**
- A stiff protocol-droid gait: short steps, near-straight knees, rigid torso, bent elbows, minimal arm swing, no hip sway.
- In stillness: one small attentive shoulder shift, faint mechanical breathing, slow blinks, the head almost still.
- Expression comes from head tilt, shoulders, arms and fingers, never from face geometry.

---

## (d) The strongest unexpected thematic connections

These are ranked by how filmable and how surprising they are. Each one makes the film about Synergy rather than about the word.

1. **His head IS synergetics.** Fuller: "Synergy means behavior of whole systems unpredicted by the behavior of their parts taken separately."
   - A triangle is the only polygon that is rigid on its own. Synergy's head is literally 23 triangular facets of flimsy sheet metal riveted into a rigid whole.
   - Fuller's "one plus one equals four": two triangles fold into a tetrahedron, and four faces exist where there were two.
   - Fuller's **jitterbug**: a cuboctahedron cage twists and collapses through the icosahedron and octahedron down to a tetrahedron, then blooms back. A plate-built head could perform it.
   - *Use: build his head from a murmuration of plates; let deferred objects self-assemble into tetrahedra; use the jitterbug as a breathing transition.*
2. **"Offline" is where synergy actually happens.** Canon's running joke is that problems vanish into an unseen "offline". Real synergy is leaderless self-organization:
   - starlings each tracking only their 6–7 nearest neighbours (Ballerini 2008)
   - fire-ant rafts
   - Physarum slime mould rebuilding the Tokyo rail map
   - lichen: a fungus and an alga as one organism

   So the place he dumps everything turns out to be the only place in the film where things work together, and **it doesn't need a host**. That is the satire, wordless.
3. **Chief Alignment Officer meets Huygens' "odd sympathy" (1665).** Two pendulum clocks on one shared beam fall into lock-step through the wood. In the modern version, 32 metronomes on a swinging platform sync in about 2 minutes. Synchronised applause is real too: audiences spontaneously fall into rhythmic clapping (Néda et al., *Nature* 2000, "The sound of many hands clapping"; added from general knowledge, not in the research packet). Synchronous fireflies, *Photinus carolinus* in the Great Smoky Mountains, are another general-knowledge addition. His job title, the banner crew's spirit level and the applause ending all rhyme with this.
4. **Sherrington's reciprocal innervation** (1906): "harmonious synergy, co-operating for one effect". When one muscle contracts, its antagonist yields. *Use:* the two chrome neck pistons in macro, one extending while its partner relaxes, as he turns his head. Sherrington's **"enchanted loom"**, "millions of flashing shuttles weave a dissolving pattern", is a beautiful image of light inside the LED matrix.
5. **1 Corinthians 3:9**, the earliest famous use: "we are *synergoi*... you are God's **field**, God's **building**." The word was born holding the film's two worlds, nature (field) and office (building).
6. **The pamphlet wars.** 17th-century Puritans and Anglicans fought over "synergism" in a blizzard of printed pamphlets. The word was born in a paper storm; the printer gag is 400 years old.
7. **Venetian blinds and the Supine Dome (Black Mountain, 1948).** Fuller's students built a dome from venetian-blind slats, and it sagged flat in the meadow. Every office has venetian blinds. Then came **tensegrity**: struts that never touch each other, held up only by tension. That is a perfect wordless metaphor for a meeting culture where nobody's work touches anybody else's and the structure still stands.
8. **Trim tab vs. inflation.** Fuller's trim tab is a tiny flap that turns an ocean liner, a small action with a huge effect. LinkedIn inflation is the parody of it: "I booked a meeting" becomes 1,834 reactions.
9. **2 + 2 = 5 and the write-down** (Ansoff 1965; AOL-Time Warner's $99B goodwill write-down; McKinsey's finding that about 70% of revenue synergies never materialise). This rhymes with "We'll take the actual numbers offline" and "I'll carry the zero forward". A glass zero monument is a wordless way to say it.
10. **Expo 67's burning skin.** The acrylic skin burned off in minutes and the steel skeleton survived. Read it as corporate veneer versus structure. Use it as inspiration only.
11. **Circle back = orbit = loop.** In canon, "a circle implies you will eventually come back to where you started." *Use:* a 360° camera orbit that lands frame-matched on an earlier frame, so the film loops.

---

## (e) Art-direction rules (must not be broken)

**E1. No text, anywhere.**
- No letters, numerals, glyphs, logos with letters, UI, captions or titles.
- The **badge card is blank**. If anything is on it, use only a tiny green 2×3-dot motif.
- **The LinkedIn "in" logo is letters, so replace it** with a letterless cobalt rounded square, or a cobalt edge band on paper and banners.
- **Clocks have hands only**, no numerals.
- **Keyboards have blank keycaps.**
- **CRTs and terminals show only square pixels and colour fields**, never characters.
- No exit signs, printer labels or folder tabs with writing.

**E2. Identity lock.**
- Never redesign him, round him, or turn him into C-3PO or a generic robot.
- The wedge points to the viewer's left and the earcup is on the viewer's right.
- The cup is in his right hand and the chip is on his left chest.
- Keep the same ivory/chrome body, scale, headset, lanyard and cup in every shot.

**E3. Face screen.**
- The screen is a flat, rigid black glass panel.
- **All LED light stays inside the glass**: no green spill on the plates, no green rim lights on his body, no cream patches on the screen.
- The bezel and plates never deform.

**E4. Mouth.**
- One fixed-height horizontal row.
- Only brightness moves, and only **left to right**.
- Never stacked rows, vertical EQ bars, an opening mouth, or a U smile.

**E5. Eyes.**
- Square pixel arrays: 2×3 neutral, with 3×3 plus brows as the rare hero register.
- No round pupils, catchlights, caret ^ ^ eyes, worried brows or "cute" faces.
- Blinks stay inside the eye regions.

**E6. Performance.**
- Small, deliberate, mechanical moves.
- No dancing, mugging, exuberant gesture or human shoulder roll.
- Acknowledgment is **ONE** small head dip.
- Never a frozen statue: there is always faint mechanical breathing.

**E7. No human faces on camera** (editor's recommendation; the stylized-human uncanny risk would sink "phenomenal").
- Colleagues exist only as abstract CRT colour fields, out-of-focus silhouettes, or a pair of hands at the very most.
- The band exists only in the music.
- Pat is the dark grey tile.

**E8. Paper physics.**
- Sheets keep office-paper size and move only outward from the slot.
- They land flat on supported stacks.
- Stacks never shimmer, shrink or multiply in place.
- Nothing is played in reverse; return journeys are new shots, not reversed footage.

**E9. Paper droid.**
- The tow bar stays rigidly connected.
- Consistent size, steady wheeled travel and measured stops.
- No limbs and no face.

**E10. Camera.**
- No fake shake, film jitter, flicker or VHS artifacts.
- Moves are locked, dolly, crane or orbit, with documentary calm and physically plausible lenses (macro 100 mm, character 50–85 mm, vista 24–35 mm).
- Use depth of field and bloom like a real camera. No glitch transitions.

**E11. Tone.**
- Dry, sincere, "almost imperceptibly sarcastic".
- The contrast between corporate aspiration and mundane machinery IS the joke.
- No whimsy, no horror, no confetti, no cheering, no explicit punchline.
- Beauty is played straight.

**E12. Contact and craft.**
- Every contact is physically honest: fingers actually grip, cables actually plug in, plates actually seat.
- No interpenetration and no floating props.
- Satisfaction comes from precise locks, clicks and syncs landing on the beat.

**E13. Originality.**
- Fuller, Snelson, EPCOT and Disney's strategy chart are inspiration only.
- No replica Needle Tower, no Spaceship Earth likeness, no Disney IP.
- Invent our own geometry: different strut counts and twists, in the cream/grey/cobalt palette.

**E14. Sound.**
- **No sound synthesized or generated in code. That includes Synergy's canonical eSpeak voice, which is code-generated and therefore excluded.**
- The film is instrumental and wordless. Use only free, professional, licensed downloads: Freesound CC0/CC-BY, Pixabay Music/SFX, Sonniss GDC bundles.
- Avoid BBC SFX (non-commercial licence). Keep a licence and attribution log.
- His "speech" is the LED wave, timed to a phrase in the found music.

**E15. Lighting.**
- The office is realistic fluorescent white with warm practicals.
- Hero shots get deliberate cinematic rim light and negative space.
- Nature is golden hour or dusk, with volumetric haze.
- Every frame should hold up as a still: clean, detailed and uncluttered.

---

## (f) Three candidate story spines (60 s, wordless)

Tempo grid: the canon groove is 88 BPM, so one bar is 2.73 s and 60 s is 22 bars. The final cut follows whichever found track is chosen; cuts and locks land on downbeats.

### SPINE A: "OFFLINE" (RECOMMENDED)

**Logline:** The robot who takes every problem offline finally takes himself there, and discovers that "offline" is a vast, silent wilderness where everything he ever deferred has been doing what his name actually means: working together, without a host.

**Why it tells the Synergy story:** It uses his single most repeated canon beat (all 14 meetings, the yellow-jack sticker) and his host role. It reveals the word's true meaning (Fuller, Sherrington, starlings) in the place he dumps everything. It breaks the cup rule once for an emotional crack ("certifies fluency, not sincerity"). It ends on the canonical single head dip, and its structure is literally "circle back". This refines the lead director's "OFFLINE" draft (scratchpad/concept_offline_draft.md) by adding a cause for his fall: the last cable he unplugs is his own.

| t | Shot |
|---|---|
| 0:00–0:04 | **A1, ASSEMBLY.** A black void with haze. About 2,000 cream riveted triangular plates, each real (rivets, rust), drift in a starling murmuration, rim-lit. Slow push. |
| 0:04–0:08 | **A2.** The flock spirals in. Plates lock edge to edge around a floating black glass screen, one metallic tick per lock. One hero macro shows two triangles folding into a tetrahedron (1+1=4). The headset swings in and clamps. |
| 0:08–0:11 | **A3, BOOT.** Macro: one green pixel, then eye 1, eye 2, a blink, and one mouth sweep left to right. Pull back: a dark open-plan office at dawn. Fluorescent panels clunk on overhead, one per beat, receding to infinity. Coffee already in hand. |
| 0:11–0:15 | **A4, THE MEETING.** A long glossy table under a curved array of 11 beige CRT monitors on arms (the call gallery made physical). Each shows a soft colour field; one is dark grey (Pat). One per beat, **problem objects push out through the curved CRT glass**: a padlock (access), a glass zero (the numbers), an envelope (spam), a fan of three tabs (the third tab). Each trails a yellow cable to a jack in the table. |
| 0:15–0:19 | **A5, THE RITUAL.** Close-up: head tilt, mouth wave ("Outstanding."). Macro of cream, black-banded fingers pinching a jack: pull, click, the glow dies, and the object drops through an iris in the table. Three times, each cut tighter, the same gesture, perfectly repeated. |
| 0:19–0:22 | **A6, THE TURN.** One yellow cable remains. His eyes follow it: it runs to his own headset. A beat. He unplugs himself. Click. The CRTs freeze and his eyes drop to idle. |
| 0:22–0:25 | **A7, THE DROP.** The floor irises open. He descends perfectly upright, rigid, coffee level, not a drop spilled. He falls through floor tiles, a server hall of square-pixel terminals, then fibre bundles that streak into white. |
| 0:25–0:31 | **A8, OFFLINE.** He emerges from a clear sky into an immense golden-hour valley of mist, pines, a lake and cliffs. **The landscape is built from everything ever taken offline:** mossy mountains of padlocks, cliffs of blank folders, terraced paddies of spreadsheet tabs holding the sky, a giant glass zero half-sunk in the lake like a monument, printer-paper snow on the peaks, and unplugged yellow cables grown into vines. |
| 0:31–0:36 | **A9, SYNERGY.** He sits on a lakeside rock. The paper droid tows reams along a dirt path through tall grass; it has been delivering offline all along. Around him, deferred things quietly work together: sheets lift and fold into triangles, three struts click into a rigid triangle, tetrahedra lock into an octet truss, and a small tensegrity mast rises from the reeds with struts that never touch. |
| 0:36–0:42 | **A10, THE SIP.** He takes the headset off and sets it on the rock. Three-quarter view from his right, so the wedge hides the contact: **for the first and only time, he lifts the cup and sips.** His pixel brows lift one notch and the mouth row makes one slow, warm sweep. Lake lapping, wind, one distant bird. |
| 0:42–0:46 | **A11.** Wide: a murmuration of cream triangles crosses the sunset over the lake. For two seconds it forms his two-eyed face, then dissolves. |
| 0:46–0:50 | **A12, THE CALL.** A yellow vine twitches and plugs itself into the headset on the rock. He regards it, puts the headset back on and stands with protocol-droid stiffness. |
| 0:50–0:57 | **A13, CIRCLE BACK.** A 360° orbit begins. Behind a foreground wipe (a passing strut or the flock), the lakeside swaps for the conference room. The 11 CRTs flicker in applause, chaotic at first, then **locking into synchronised pulses** on the beat. |
| 0:57–1:00 | **A14.** One small head dip, one blink. A new problem pushes out of a CRT. Cut to black on the click. The end loops to A4. |

- **"How did AI make this" moments:** solid objects pushing through refracting CRT glass; the murmuration assembling his head; the macro fingers; the upright fall through a building cross-section; the scale of a valley made of office debris; self-assembling tetrahedra and tensegrity; the sip; the frame-matched orbit swap.
- **Sound:** office room tone, fluorescent ballast clunks, CRT power-on thumps, relay clicks, jack pulls (pick a satisfying 1/4-inch plug sample), pneumatic and fall whooshes. The valley gets wind, water lapping, birds and a starling murmuration recording. The ending uses applause that syncs.
- **Music:** one instrumental track at 84–96 BPM that drops out to near-silence for the valley (A8–A11) and returns on A12.
- **Build cost:**
  - Sets: office + conference room, a procedural fall shaft, a procedural valley with terrain, water, fog and scattered prop instances.
  - Systems: two boids systems (the plates, the triangles).
  - Biggest risks: the valley's vegetation density and render time. Mitigate with fog, depth of field and instancing.

### SPINE B: "PAPERLESS"

**Logline:** Synergy unveils the company's paperless future. Behind him the printer begins, one sheet per bar, and does not stop until the paper has become a landscape, then a weather system, then a single living leaf.

**Why it tells the story:** It is pure canon (paperless-0/1, Synthia printing "one for every stakeholder. Plus spares.", the printer and the droid, "Optimizing"). It has built-in percussion and the cleanest irony with zero words. It is the lowest-risk spine and has the most beautiful final image.

| t | Shot |
|---|---|
| 0:00–0:05 | **B1.** A kitchenette at blue dawn. Macro: the printer's lime LED pulses like a heartbeat. Rollers turn and one sheet (cobalt corner square, no letters) slides out and lands flat on the tray. That sheet is the downbeat. |
| 0:05–0:11 | **B2, THE UNVEILING.** Synergy (with Synthia and her scarf optional) beside a sleek black glass terminal whose screen grows a **pixel sapling** in green square LEDs, the same visual language as his face. A real potted sapling stands beside it. A mouth sweep. In the background, the printer feeds sheet two. |
| 0:11–0:16 | **B3.** He holds proud and perfectly still. Synthia hands him a printed copy of the announcement: the pixel sapling, on paper. He regards it. One blink. |
| 0:16–0:25 | **B4, ESCALATION.** One cut per bar: the stack climbs; the droid arrives and tows; carts multiply into a convoy across navy carpet; the stack touches the ceiling tiles; paper waterfalls down a stairwell. Synergy is in each frame, increasingly surrounded and utterly composed, cup level. |
| 0:25–0:31 | **B5.** A sheet slips out of a window into the wind. Outside, thousands of sheets fold into paper birds over a lake at dusk. |
| 0:31–0:41 | **B6, THE PAPER WILDERNESS.** Paper falls like snow on a forest of folded triangular paper conifers, crease-faceted like his head. The droid tows through drifts and leaves tracks. Among the paper trees, the terminal's "paperless" dream has gone feral as fibre-optic trees glowing green. |
| 0:41–0:48 | **B7.** Synergy alone on a paper summit at dusk, cup in hand. **A continuous pull-back** reveals the whole range is the output stack on the kitchenette table, back at office scale. |
| 0:48–0:55 | **B8.** The printer feeds one last sheet. Mid-air it unfolds, crease by crease, into **a real green leaf** with translucent veins. |
| 0:55–1:00 | **B9.** The leaf drifts down into his coffee, floats and slowly turns. He looks down at it. One head dip. The LED pulses once. Black. |

- **"How did AI make this" moments:** paper simulation at scale; the paper forest; the origami-to-leaf transformation; the scale-cascade pull-back; the leaf in the cup.
- **Sound:** the printer feed as the kick (real laser-printer recordings), paper rustle and flutter, droid casters, wind, birds, snow hush.
- **Build cost:** medium. The kitchenette, office and stairwell, plus one stylized outdoor set. Many paper instances, but rigid-body or keyframed sheets are tractable.
- **Weakness:** less of the "terminals" brief, and less of his character beyond the deadpan. Synthia splits focus.

### SPINE C: "ALIGNMENT"

**Logline:** His title is Chief Alignment Officer. All film long he does nothing but stand, hold his coffee and look extremely serious, while everything around him, from desk metronomes to starlings to a field of fireflies, falls into perfect sync.

**Why it tells the story:** It turns his title and his do-nothing hosting into the plot. It draws on the word's deep history (Huygens' "odd sympathy", Sherrington's harmony), the banner crew's spirit level, and the synchronised-applause finale. It is the most purely satisfying and procedural of the three.

| t | Shot |
|---|---|
| 0:00–0:06 | **C1, PROLOGUE.** Candlelight. Two antique pendulum clocks (blank dials) hang on one oak beam, swinging out of phase; dust motes tremble on the beam; they lock in anti-phase. A match-cut turns the oak beam into the edge of a long modern office desk. |
| 0:06–0:12 | **C2.** Morning chaos on the shared desk: 32 brass metronomes, desk pendulum toys, oscillating fans, swaying blinds, square cursors blinking on beige CRTs, the printer, all out of phase. Synergy enters with a protocol-droid gait and lays a brass **spirit level** on the desk. The bubble drifts and settles dead centre. |
| 0:12–0:24 | **C3, THE LOCK.** One by one, along a Kuramoto curve, everything syncs: metronomes, fans, blinds, cursors, the printer's feed and his own mouth sweep. **The beat drops at the exact frame the last metronome locks.** |
| 0:24–0:36 | **C4, IT ESCAPES.** Outside the window, office-park trees sway in phase. A starling murmuration over the car park becomes one breathing shape. At dusk, a meadow of fireflies pulses in unison, the same green as his eyes. |
| 0:36–0:46 | **C5, THE JITTERBUG.** The rhythm reaches him. In extreme close-up the neck pistons work in reciprocal pairs, then his head plates unlatch and **breathe**: a cuboctahedral jitterbug in time with the music, then they reseal with a cascade of rivet clicks. |
| 0:46–0:55 | **C6.** The conference room. The CRT gallery's applause flicker starts ragged, then syncs. Synergy gives one head dip. |
| 0:55–1:00 | **C7.** Silence. One metronome on the desk is half a beat off. Tick. He turns his head toward it, slowly. Black. |

- **"How did AI make this" moments:** procedural mass-sync (deeply satisfying); the jitterbug head; the firefly meadow; the reciprocal-piston macro.
- **Sound:** metronome ticks (real recordings), clock escapements, fan hum, blind slat rattle, crickets, fireflies' night ambience, applause.
- **Build cost:** medium-high. Many simple instanced oscillators are cheap. The meadow and fireflies are moderate. The jitterbug rig is a hero build.
- **Weakness:** the lore is told through his title more than his canonical gags, and it has less narrative arc.

### Recommendation

**Shoot Spine A, "OFFLINE".** It is the only spine that tells who Synergy is (host, deferral, deadpan), what his name really means (self-organizing synergy), and what he secretly knows (the sip). It satisfies "terminals, nature" literally, and it loops.

Pieces to steal from the other two if time allows:
- From B: the printer feeding sheets in the background of A3 and A4.
- From C: the synchronised-applause lock in A13 (already included), and a 2-second jitterbug-head "breath" as the wipe in A13.

**Production priorities:**
1. The character (head plates, LED screen, fingers and cup at hero macro quality).
2. The CRT push-through.
3. The valley vista.
4. The orbit swap.

### Open decisions and flags for the orchestrator

- **Badge:** blank card (recommended) or a tiny green 2×3-dot motif. The canon badge text "SYNERGY" conflicts with the no-text rule.
- **Paper and banners:** a letterless cobalt square replaces the "in" logo (letters and a trademark).
- **Humans:** none on camera. Applause is carried by CRT flicker plus licensed applause audio.
- **Voice:** none. The canonical eSpeak voice is code-generated and excluded; the mouth wave is keyed to the music.
- **The sip:** used once only, staged from the character's right so no mouth-contact problem is visible.
- **"Mascot":** README.md names Barry the pigeon as the site mascot. The user clearly means the robot in the attached image, so ignore Barry.
- **9:03:** if used, as clock hands only, no numerals.
