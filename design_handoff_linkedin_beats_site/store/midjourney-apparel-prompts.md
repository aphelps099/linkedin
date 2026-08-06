# Midjourney — Apparel Product Shots
The Company Store · v7 syntax · use `--style raw` always (kills Midjourney's default prettiness — the brand wants clinical).

## Base parameters (append to every prompt)
`--ar 1:1 --style raw --stylize 50 --no lens flare, golden hour, bokeh, smiling at camera, neon, exposed brick, HDR`

## Recurring style string (paste into every prompt)
> deadpan corporate stock photography, mid-2000s office, cool even fluorescent lighting, muted palette of off-white and grey with corporate blue #0a66c2 accents, neutral competent expression, centered formal composition, medium format, clinical flatness

---

## CS-101 · The Circle Back Tee
1. `woman in her mid 30s wearing an off-white heavyweight cotton t-shirt with small black helvetica wordmark on left chest, open grey blazer, standing in an empty beige conference room beside a whiteboard, arms at sides, looking slightly off-camera, [style string] --ar 1:1 --style raw --stylize 50 --no [negatives]`
2. `man in his mid 30s in the same off-white tee tucked into pleated slacks, seated at a beige cubicle desk, hands folded, dark CRT monitor, fluorescent office, [style string] ...`
3. `flat lay of an off-white heavyweight t-shirt folded with machine precision, small black text on chest, straight-down view, seamless white background, soft even shadow, e-commerce catalogue photography, [style string] ...`

## CS-102 · Per My Last Email Tee
1. `woman in her mid 30s wearing an off-white t-shirt printed PER MY LAST EMAIL in black helvetica across the chest, standing in an office kitchenette holding a plain mug, corkboard of memos behind, [style string] ...`
2. `man in his mid 30s in the same tee under a fleece vest, in front of grey filing cabinets, arms loosely crossed, neutral face, [style string] ...`
3. `ghost mannequin product shot of an off-white t-shirt printed PER MY LAST EMAIL in black helvetica, front view, seamless light grey background, perfectly symmetrical, retail photography, [style string] ...`

## CS-103 · The Serious Tee
1. `woman in her mid 30s wearing an off-white t-shirt printed SERIOUS in black helvetica, standing dead-center in a fluorescent hallway of closed office doors, facing camera, serious expression, [style string] ...`
2. `man in his mid 30s in the SERIOUS tee seated on the edge of a boardroom table, hands on knees, blank projection screen behind, [style string] ...`
3. `flat lay of the folded SERIOUS tee, text perfectly horizontal, straight-down, seamless white, catalogue lighting, [style string] ...`

## CS-201 · Thought Leader Cap
1. `man in his mid 30s in a grey suit wearing an unstructured corporate blue baseball cap embroidered THOUGHT LEADER in white, standing at a lectern in an empty seminar room, hands gripping the lectern, [style string] ...`
2. `woman in her mid 30s in a blazer wearing the blue THOUGHT LEADER cap, seated alone in the front row of empty conference chairs, closed notebook on lap, [style string] ...`
3. `product shot of an unstructured corporate blue six-panel cap with white THOUGHT LEADER embroidery, floating at three-quarter angle, seamless white background, crisp even studio light, e-commerce photography, [style string] ...`

## CS-202 · Take This Offline Cap
1. `woman in her mid 30s in business casual wearing a black baseball cap embroidered TAKE THIS OFFLINE in white, stepping out of a glass meeting room, hand on the door handle, [style string] ...`
2. `man in his mid 30s wearing the black cap in an office stairwell under fluorescent light, closed laptop under one arm, [style string] ...`
3. `product shot of a black unstructured six-panel cap with white TAKE THIS OFFLINE embroidery, dead-on front view, seamless light grey, centered, soft shadow beneath, [style string] ...`

---

## Tips for this brand
- Midjourney mangles garment text: generate the garment clean (`plain off-white t-shirt, no print`) and composite the type in post — the print is Helvetica, you own it.
- Keep `--stylize` ≤ 50; higher values drift toward editorial glamour, which breaks the deadpan.
- For the featured row (4:3): swap `--ar 4:3` and add `subject offset to the left third, generous negative space right`.
- Seed-lock a good model (`--seed N`) and reuse across a product's 3 shots for casting continuity.
