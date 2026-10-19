# Inline post-to-beat player

Open `/lessons/` and press the small player's yellow play button. Playback transforms the output area into a singalong. The listener gets play/pause, restart, a **Read post** toggle, and **Share this beat**. There is no mixing console or voice-selection UI. Editing the source post tears down the old player and its audio. Hidden tabs pause playback; returning does not autoplay.

The 30-second, 96 BPM arrangement uses the homepage's actual `createAudioEngine`, chord progression, bass and keys from **Synergy in B2B Minor**, at a slower tempo. Familiar female phrases load the exact `/public/phrases/*.wav` recordings; new chorus lines use the local Kokoro `af_heart` voice at 0.97 speed. Fred supplies the computer replies. Kokoro is a new casting candidate, not a clone or a verified identification of the original voice. The recorded female voice's original provider/preset is not documented in the repo.

`POST /api/post-beat/voices` runs the same Kokoro quantized 82M model in development and production, using two CPU inference threads without idle spinning. The Docker build downloads the model and smoke-tests both voices before releasing the image. Server startup warms the model before accepting traffic. The model stays server-side, outside the browser bundle. No ElevenLabs or other paid speech API is called.

The 43 common Fred phrases in `server/beat-bank/` retain the approved recordings on Linux. New robot lines use Fred on macOS and eSpeak NG (`en-us`, 154 wpm, pitch 35) on Linux; eSpeak is a portable retro voice, not an exact Fred reproduction. `scripts/build-beat-robot-bank.mjs` deliberately refreshes the bank on macOS. Original female samples and generated Kokoro choruses are unchanged between platforms.

The production cache is private at `/data/linkedin-beat-cache`, separate from newsletter data. It uses atomic writes, a 32 MiB cap and seven-day expiry, with least-recently-used eviction. Clips are reused across shares/restarts. The endpoint validates up to eight lines / 600 total characters, checks browser origins, limits each IP to 20 requests per 10 minutes, combines identical in-flight requests, and serializes inference with at most four pending jobs. The Docker image contains eSpeak and the model; it does not need speech API credentials. `POST_BEAT_CACHE_DIR` overrides storage for another environment. `/api/health` includes `postBeatConfigured`.

The chorus and keywords come from the post. The arrangement adds recorded corporate hooks; when a matching original phrase exists in the post it is preferred. Every displayed lyric matches the selected audio text. Word times are estimated by syllable weights within measured speech bounds, driven by the audio clock; they are not forced alignment. Pausing freezes the word highlight. Future production voice alignment can replace the timing estimator without changing the UI.

Sharing copies the chosen recipe in a URL fragment (chorus, keywords, original recording IDs, arrangement version and tempo). Version 1 preview links remain readable. Public-host share uses the native share sheet when available, otherwise the clipboard. Recipients open a focused player and generate/reuse the same selected vocal lines on demand; the link remains usable after cached audio is evicted. There is no stored video or rendered full-song file. A localhost link remains local to that computer.

Validation:
- `node scripts/check-post-beat.mjs`: 40 generated-post fixtures, source excerpts, voice roles and safe recipe-link parsing.
- `node scripts/check-post-beat-transport.mjs`: actual recorded PCM, nonoverlapping cues, word-time bounds, reused band/voice routing, pause/resume, replay, completion and cleanup.
- `node scripts/check-post-beat-service.mjs`: input validation, origin checks, rate limits, private errors, queue bounds, request deduplication, persistent cache reuse, eviction, and failure recovery.
- `node scripts/check-home.mjs`, `node scripts/check-lessons.mjs`, `npm run build`.
- Browser checks cover local Kokoro generation, original sample playback, highlighted words, compact layout, switching to the post, editing, and mobile overflow.
