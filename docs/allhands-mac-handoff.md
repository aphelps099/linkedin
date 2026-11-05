# All Hands: the Mac takes over

For the Claude Code session on Aaron's Mac, and for Aaron. As of Nov 5, 2026, the heavy work on LinkedIn Beats' All Hands (renders, listening, exports) moves from the cloud to the Mac. The Mac renders a Drop Edition song in 15 s.

## One rule before anything else

**One session works on this branch at a time.** Two sessions editing the same files undo each other.

- Starting: `git pull` first. The cloud session has stopped by the time you read this.
- Stopping: commit, push and leave a line on the PR saying where you stopped. The next session, cloud or Mac, starts from there.

## Where things are

| | |
|---|---|
| Branch | `claude/gallant-ramanujan-6arg3u` |
| Pull request | [aphelps099/linkedin#173](https://github.com/aphelps099/linkedin/pull/173) (draft) |
| Mac worktree | `~/Documents/GitHub/linkedin-allhands` |
| Live site | linkedinbeats.com on Render, media in a Cloudflare R2 bucket |

`~/Documents/GitHub/linkedin` is a separate checkout on `claude/clever-maxwell-psvch4` with Aaron's uncommitted work from another session. Never stash, reset, check out or commit there. Work only in the worktree.

## What's built

Each area has a README that is the contract. Read it before changing that area.

- **The song engine**: `src/allhands/README.md`. A LinkedIn post becomes a song: Synergy (eSpeak through a vocoder) sings it; the lady's 57 recordings, Strategy and Synthia answer.
- **The song book**: `src/allhands/songbook/`. Four tracks: Circle Back, Humbled and Honored, Hustle (the Drop Edition) and Offsite (the river). `CONSTITUTION.md` is the composition law: read it before writing a note.
- **Casting**: `src/allhands/casting.js`. The post chooses its track and who sings what.
- **Vocabulary and voices**: `src/allhands/vocabulary/LEXICON.md` and `src/allhands/voices/README.md`. 135 expressions and 71 couplets ("It's not X. It's Y."), plus 294 pixelated Strategy and Synthia takes.
- **The Peg Board**: `src/pegboard/README.md`. The pixel type that lights up with the song; the specimen is at `/pixel-type/`.
- **The video studio**: `src/videostudio/README.md`. Shot index, EDL, WebGL compositor and WebCodecs export, at `/videostudio/`.

## The Mac, set up

Already done:
- Homebrew in `/opt/homebrew`
- espeak-ng 1.52.0 (Synergy's voice: without it the dev server returns 502 "Synergy could not be reached")
- the Node packages
- `.venv` with numpy, scipy and faster-whisper
- Playwright's Chromium

Shells that Claude starts may not have Homebrew on the PATH. Start each session with:

```bash
cd ~/Documents/GitHub/linkedin-allhands && export PATH="/opt/homebrew/bin:$PATH" && source .venv/bin/activate
```

Before the first gate or export, check for ffmpeg, which both need:

```bash
ffmpeg -version || brew install ffmpeg
```

Downloads on first use:
- Whisper `small.en`, a few hundred MB, the first time a gate listens.
- Kokoro, Strategy's voice, only when rendering new voice takes. `render-song-voices.mjs --models DIR` fetches it from Hugging Face, and the renderer refuses any copy that isn't the voice bank's approved artifact.

Only for new voice takes, which is not routine work:
- **Synthia needs FFmpeg built with libflite**, and Homebrew's ffmpeg likely doesn't include it. Check with `ffmpeg -hide_banner -filters | grep flite`. If it isn't there, render her new lines in a cloud session.
- **The aligner** (`src/allhands/voices/measure.py align`) needs pocketsphinx and torchaudio, which aren't in `.venv` yet.

## The commands

The dev server, in its own terminal tab. The page is at http://localhost:5173/allhands/:

```bash
npm run dev
```

Every check, then the build. Writes a log for each check and a summary. Add `--full` for the compositor and real exports. Add `--only casting,songbook` to run a few.

```bash
node scripts/check-all.mjs
```

A song, as a WAV plus its plan. Needs the dev server running:

```bash
node scripts/render-allhands.mjs --track offsite --out ~/Desktop/takes
```

The audio gates: loudness, true peak, the drop's or swell's lift on a phone, silence before the impact, and Whisper on the windows you pass:

```bash
python3 scripts/measure-allhands.py ~/Desktop/takes/allhands-offsite-own-sung.wav --plan ~/Desktop/takes/allhands-offsite-own-sung.json
```

A film. It starts its own dev server:

```bash
node scripts/export-videostudio.mjs --track circle-back --format 9:16 --out ~/Desktop/films
```

After any change to the drop, re-measure which couplet punchlines Whisper hears in the mix. Needs the dev server. This rewrites `src/allhands/vocabulary/impact-heard.json`, which casting reads:

```bash
node scripts/measure-impacts.mjs --work ~/Desktop/impacts
```

Each script's header comment lists every flag.

## What "done" means

- **Mix**: −10 ±1 LUFS, true peak −1 dBTP or lower.
- **Drops and swells**: every Drop Edition drop at least +2.5 LU over the verse, including on a phone speaker. Every river swell at least +2 LU.
- **The impact**: digital silence before it, about 0.39 s after her tag ends (Circle Back's gap is the reference).
- **Whisper**: hears Synergy, the lady, and the cast's clear lines and punchlines.
- **Determinism**: the same post renders the same bytes in a fresh browser.
- **The board**: whole words, fully lit. Each format has one home and the board never jumps. The flash governor allows at most 3 flashes a second. Video lint G1 to G14 is clean.
- **Checks**: `node scripts/check-all.mjs` passes.

## The canon

- The lady never has a face. Pat is never on camera. The type is never green. No Zoom or Lite-Brite marks.
- Only project-owned audio. No paid voice APIs: no ElevenLabs, no OpenAI, never the production `/api/voice` for renders. The lady keeps her 57 recordings; Strategy and Synthia carry every new word.
- Synergy learning the synth is backstory. It is never shown.
- The five references (Daft Punk, Panda Bear, Washed Out, Air, Kraftwerk) shape sound and approach. Never take their melodies, lyrics, samples or structures.
- Never print or commit a signed URL, token or key. `CATALOG_UPLOAD_TOKEN` lives in Render's environment, not in chat.

## Git

- Commit on this branch only, and push with `git push -u origin claude/gallant-ramanujan-6arg3u`. No force pushes, no rebases of pushed history.
- Pull requests are drafts, titled "[WIP, don't merge]" until they're ready. Aaron merges. Claude never does.
- Keep model names out of commits, PRs and code.

## Where the last round left off

The vocabulary polish round (couplet punchlines heard, clearer single words, the river's slow bloom, her rotating moments) is being verified in the cloud as this note is written. Its results and open gaps go here when it lands.

## What's next

1. Aaron listens to this round's takes and gives notes.
2. Proxies to production: `node scripts/build-videostudio-proxies.mjs --upload`, once `CATALOG_UPLOAD_TOKEN` is set in Render and exported in the Mac's shell (typed there, never pasted into a chat).
3. P4, the Studio editor, only when Aaron asks.
