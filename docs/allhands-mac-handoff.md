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

## Publishing to the Cutting Room

Everything finished goes into the library at `/cutting-room/` with one command (the contract is
`src/cutting-room/README.md`, Publishing). It needs ffmpeg and `npm install`. The cloud versions of the
three Claude Code films are in the catalog now; each Mac master replaces its cloud version, which stays
on as an Earlier version. Render and review each film as its own brief says first.

- **Printer Song** (`docs/printer-song-video.md`; the render writes `~/Desktop/printer-song-9x16.mp4`). Settle the record's two notes first (the thin green tile border around the mouth, the "in" mark on the pages). Over 25 MiB it gets a two-pass encode at 1080; if the print raster smears, add `--r2`.
  `node scripts/publish-to-cutting-room.mjs ~/Desktop/printer-song-9x16.mp4 --replaces printer-song-776d0c96 --status "Current edit" --notes "The 1080 master, rendered on the Mac." --poster-frames 230,500,790`
- **DELVE.** (`docs/vocabulary-film.md`; the render writes `~/Desktop/delve-9x16.mp4`). Two minutes at 1080 will not fit 25 MiB at better than 720, so it goes to R2 (a video key: the deployed server already takes it). `CATALOG_UPLOAD_TOKEN` comes from Render's environment into the shell, never into a file or the chat.
  `node scripts/publish-to-cutting-room.mjs ~/Desktop/delve-9x16.mp4 --replaces delve-22ebd3ba --r2 --notes "The 1080 master, rendered on the Mac." --poster-frames 14,2100,2472`
- **Day One.** (`docs/day-one-film.md`; the render writes `out/day-one/day-one.mp4`). In SF Pro, it replaces the cloud render that used Inter; a web-ready file under 25 MiB is kept exactly as rendered.
  `node scripts/publish-to-cutting-room.mjs out/day-one/day-one.mp4 --replaces day-one-0d178d01 --notes "Final cut, 60 fps, rendered on the Mac in SF Pro." --poster-frames 0,2880,3527`

Each film's sound is measured as it ships: AAC is copied untouched, and the command stops before
writing or uploading anything if the true peak is over the film's ceiling (-1 dBTP; Printer Song,
scored with Aaron's track, -0.1). If it stops, fix the master as the film's brief says; for a song film
whose AAC overshoots, `--limit-sound` puts the sound through the limiter and keeps the picture as it is.

**The four All Hands song films.** No MP4 of them survives in the cloud (only sidecars), so they are
not in the library yet. Export each at 1080 (each brief's own gates first), then publish it beside its
song take, which it links to:

```bash
for t in circle-back humbled-and-honored hustle offsite; do
  node scripts/export-videostudio.mjs --track $t --format 9:16 --master --gpu --out ~/Desktop/films --name $t-9x16
done
node scripts/publish-to-cutting-room.mjs ~/Desktop/films/circle-back-9x16.mp4 --title "Circle Back (Drop Edition)" --category "Finished films" --made-in "Video Studio" --made-in "All Hands" --related circle-back-drop-edition-3e6a17d4 --description "French house about an onboarding checklist, cut on the beat. It's not a U-turn. It's a pivot."
node scripts/publish-to-cutting-room.mjs ~/Desktop/films/humbled-and-honored-9x16.mp4 --title "Humbled and Honored (Drop Edition)" --category "Finished films" --made-in "Video Studio" --made-in "All Hands" --related humbled-and-honored-drop-edition-cd0ae3ad --description "A neo-soul slow jam about merging two onboarding steps, on screen. It's not a complaint. It's a gift."
node scripts/publish-to-cutting-room.mjs ~/Desktop/films/hustle-9x16.mp4 --title "Hustle (Drop Edition)" --category "Finished films" --made-in "Video Studio" --made-in "All Hands" --related hustle-drop-edition-65d91575 --description "UK garage for a small process change, on screen. It's not avoidance. It's camera off."
node scripts/publish-to-cutting-room.mjs ~/Desktop/films/offsite-9x16.mp4 --title "Offsite (River)" --category "Finished films" --made-in "Video Studio" --made-in "All Hands" --related offsite-river-dccc72e3 --description "The team retreat as a river, on screen. Claps, stomps, her voice in long reverb, and one line from Synergy."
```

A film over 25 MiB gets the two-pass encode (it may step down to 720); add `--r2` to keep it at 1080.

Then `git add public/cutting-room src/cutting-room/catalog.json` and commit. Anything new (a song
take, a film) goes in the same way: `node scripts/publish-to-cutting-room.mjs --help`. Audio to R2
(`--r2` on an MP3) waits until the `server/cutting-room.js` that accepts mp3 and m4a is deployed.

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
- If Aaron merges the PR while you work, start the branch fresh from `main` (`git fetch origin main && git checkout -B claude/gallant-ramanujan-6arg3u origin/main`, rebasing any unmerged commits onto it) and open a new draft PR. Never stack new work on merged history.

## Where the last round left off

The vocabulary polish round landed at `73358df`. Every check and the build pass.

**Met:**
- **The punchline:** heard 21 of 21 times, alone in the full mix, across 3 tracks and 8 posts.
- **Determinism:** 9 of 9 fresh-browser re-renders are byte-identical.
- **The river blooms:** 3 layers by bar 6, never more than 2 new in a bar, 3 clear phrases a song, nobody trading. Whisper heard no word in the loops alone (0 of 170 windows).
- **Her moments rotate:** 11 to 18 distinct recordings per moment over 61 posts.
- **The pickup gap:** worst 0.24 s, down from 2.9 s.
- **The strike:** reads at phone size.

**Open:**
- **The board drops a couplet's Y early** on 33 of 101 screens: the next band screen starts half a beat before the last word ends. Example: "NO DAYS OFF" is on the board while "OFF." is still sung. See `src/pegboard/choreo.js`, around lines 199 and 371 at `73358df`.
- **Hustle sits on two gate limits:**
  - True peak is −0.99 to −1.02 dBTP on 5 of 7 renders.
  - The sample's Drop A phone lift is +2.52 LU against a +2.5 floor.
  - Lowering the limiter ceiling fixed the peak but broke the lift, so Hustle's mix needs the change, not the limiter.
- **Fixture 35's Drop B fails the phone lift** on Circle Back (+2.45 LU) and Hustle (+2.11 LU): Synergy's hook line there is only "The green flag".
- **"It's not X." over the build is heard only 7 of 34 times.** The "U-turn" line: 0 of 7, heard as "Utah". The board's strike carries the joke on video; the audio alone doesn't.
- **Circle Back is the weakest track for the band's words.** Only 3 couplets are heard there, and a hash correlation makes U-turn/pivot the drop 10 times in 15. "Bandwidth?" and "Alignment" get masked on Circle Back and Hustle, and Synthia's short answers are heard 4 of 11 ("None." heard as "9").
- **"Pivot" turns up in all four sample takes:** her moments rotate across posts, not across one post's tracks.

The round's numbers are in the PR description. Aaron has the takes as MP3s; render your own with the commands above.

## What's next

1. **Aaron's notes on this round's takes come first.**
2. **Fix the early Y on the board.** Small and visible.
3. **Hustle headroom and fixture 35's short Drop B line.** Re-run the gates on every track after.
4. **The setup line:** make "It's not X." heard the way the punchline now is. Then give Circle Back more heard couplets (`scripts/measure-impacts.mjs`) and decorrelate its drop pick.
5. **Proxies to production:** `node scripts/build-videostudio-proxies.mjs --upload`, once `CATALOG_UPLOAD_TOKEN` is set in Render and exported in the Mac's shell (typed there, never pasted into a chat).
6. **P4, the Studio editor,** only when Aaron asks.
