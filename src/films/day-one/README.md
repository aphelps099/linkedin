# Day One (the film's code)

A LinkedIn post on a phone, as a screen recording. A new hire, Jamie, announces her first job; the comments start warm and go automatic, rolling up the screen like a credit roll until the same sentence, "Congrats on the new role!", stacks into a wall. The picture is a web page driven by one clock (60 fps); the render captures it frame by frame. The idea, the timeline and the review checklist are in `docs/day-one-film.md`.

## Files

| File | What it is |
|---|---|
| `films/day-one/index.html` | The page (a Vite page; not in the production build). `?company=Name` switches the company. |
| `main.jsx` | Draws the whole thread once (and the phone's status bar and the app's top bar over it), measures row tops after the fonts load, and exposes `window.__dayOne = {ready, layout, seek(t), seekPainted(t), renderAudio(), info()}`. `seek` writes only what changes (camera, counters, "…more", Load more, the pinned counts row, Doug's reply). |
| `timeline.js` | Pure. The one clock: constants, specials, waves, counter landmarks, the camera's segments, `frameAt(t, layout)`, `ticks()` (every number change: the song's hi-hat), `cues()` (the statement grid), `rowBeats()`. The sound (`score.js`) imports it. |
| `rows.js` | Pure. The script made drawable: company filled in, mentions parsed, replies nested, wave rows made uniform, about 1 time in 4 swapped with its neighbour inside a wave. |
| `script.json` | The comment script, from the copy study, with `{COMPANY}` templated. |
| `Post.jsx`, `Comment.jsx`, `icons.jsx`, `day-one.css` | The components and the tokens. Icons are our own drawings (lucide strokes for the action bar); no LinkedIn artwork. |
| `avatars.json`, `public/films/day-one/avatars/*.jpg` | Which row wears which picture: 57% the default silhouette, then face-free crops of our own footage (people doing a thing) and drawn pictures (people from behind, places, a flower, a latte, three small-business marks), Jamie's a portrait from behind at a window. Made by `scripts/make-day-one-avatars.py` (drawings in `scripts/day_one_drawn_avatars.py`). |
| `score.js`, `voices.js`, `voices.json` | The sound (another workflow's files). `renderAudio()` calls `score.js`'s own `renderAudio`. |

## Commands

```
node scripts/render-day-one.mjs --out out/day-one --stills    # the film: day-one.mp4, day-one.wav, timeline.json, contact sheet, stills
node scripts/render-day-one.mjs --out out/day-one --preview   # 540x960, about two minutes
node scripts/render-day-one.mjs --out out/stills --frames 0,792,3312   # review stills only (60 fps frame numbers)
node scripts/render-day-one.mjs --out out/day-one --remux       # the sound changed: new score, same picture
node scripts/check-day-one.mjs --dir out/day-one [--compare out/day-one-2]
python3 scripts/make-day-one-avatars.py                       # the avatar crops (needs the 540p proxies)
```

## Rules the code keeps

- Every number comes from a measured row top or from `timeline.js`. Nothing in the camera is a constant pixel position, so SF Pro (the Mac) and Inter (the cloud) both land on the beat.
- A frame is a pure function of `t`: no animation, no timers, no randomness at render time. `seekPainted` waits two animation frames before a capture; a screenshot taken straight after a DOM change can catch a frame mid-raster and differ run to run.
- Type: weights 400 and 600, sizes 12 and 14 in the app (the status bar's clock is the phone's, 15/600), colours only from the tokens in `day-one.css`. Never green type (green is only the Open to Work frame, the Celebrate disc and the landscaper's mark).
- The word "LinkedIn" appears nowhere. No logo, no wordmark, no icon artwork; the status bar and top bar are our own drawing, with no app name.
- Faces: none. Avatars are the default silhouette, crops of Office and Instrument shots with `faceBox` null whose boxes show no face (never Pat), or drawn pictures with no face. Every name passed a Wikipedia exact-title check.
