# Optimize phrase player

`/optimizer` is a single canvas and transport: Play/Pause/Replay and wrapped previous/next navigation through 56 couplets and cuts from The 57. It uses the shared All Hands peg renderer and PEG-9 face. The homepage’s seven-dot carousel arrows and stepped cream play button sit beneath the stage. The existing full-screen menu is included with Optimize selected.

The 83 MP3 cuts in `public/optimizer/audio/` come from the existing Strategy/Synthia voice renders and original Lady recordings. `clips.json` retains their measured word boundaries. Audio files load on demand; voices, backing beat, typography and the LinkedIn finishing mark share one AudioContext clock. The mark lights 180 ms after the final measured word. The correction pause is 600 ms; peg glow is 1.2.

Playback starts only on a user gesture. Opening the menu pauses it; leaving the tab stops it. Sound and clip selection persist locally. The shared mobile audio session handles iOS playback, and audio focus coordinates other site players. Reduced motion removes moving backgrounds and progressive letter reveals. Buttons support native keyboard activation, with Left/Right to change clips. The canvas has a live transcript alternative.

Run `npm run dev` or `npm run build` followed by `npm run preview`, then open `/optimizer`. The former editor source remains under `src/lessons`; this change replaces its Optimize entry page.

`cuts.js` holds the ordered set: 26 couplets and 30 standalone vocabulary clips. The original 16 retain their positions, followed by 40 additions alternating corrections and short phrases. Run `node scripts/prepare-optimizer-audio.mjs` to prepare missing MP3s from the approved source recordings; `FFMPEG` can override the ffmpeg executable. Existing clips remain byte-for-byte unchanged.
