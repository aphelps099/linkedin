# The Cutting Room

Unlisted catalog at `/cutting-room/`. No public nav or sitemap entry. HTML and server responses send noindex. **This is not password protection.** Anyone with the link can view the footage.

## Reuse

Search cast, scene descriptions, and recovered scripted dialogue. Filter older versions or review flags. The shortlist and notes are local to the browser; JSON export preserves a portable edit list. Only an opened clip creates a video element. Images are lazy loaded and the grid is paginated.

## Media

Existing public site media keeps its existing URLs. Recovered masters and source takes live in the site's Cloudflare R2 bucket, under `media/`. `/api/cutting-room/media/:key` issues a one-hour signed playback/download URL. There are no signed URLs or storage keys in the browser bundle. URLs contain a content hash so revisions never replace cached media.

Uploads require `CATALOG_UPLOAD_TOKEN` via Bearer header. Storage credentials are server-side environment variables on the Render web service (`CATALOG_S3_ENDPOINT`, `CATALOG_S3_BUCKET`, `CATALOG_S3_ACCESS_KEY`, `CATALOG_S3_SECRET_KEY`, `CATALOG_S3_REGION`), alongside `CATALOG_UPLOAD_TOKEN`. Never commit credentials or signed source URLs. Max upload 300 MiB. No list/delete endpoint is exposed.

## One library: films, songs, sounds and packs

Everything made for the site ends up here, whatever made it. A record is a film, a song or sound,
or a pack (a collection shown as one card that opens a list player). The vocabulary lives in
`src/cutting-room/taxonomy.js`, which the page, `scripts/lib/cutting-room.mjs` and the check share.

- **Categories**, in pill order: Everything, Finished films, Songs, Character performances, Office
  scenes, Screen inserts, Instruments, Sounds, Experiments. Instruments are video plates; the
  instrument sounds are a pack in Sounds.
- **Made in** (`madeIn`, a list; the first is primary and shows on cards, the filter matches any):
  Cutting Room originals, Studio and meeting rooms, Video Studio, All Hands, Claude Code films,
  Aaron's tracks.

**Schema v2** is additive: a field that is absent keeps its old meaning, so every older record reads
as before.

| Field | Meaning |
|---|---|
| `kind` | `video` (the default), `audio` or `pack` |
| `madeIn` | required, values above |
| `added` | ISO date, new records only; the four newest show under the hero as Just made |
| `src` | the file; for a pack, its list (`/cutting-room/packs/<id>.json`) |
| `poster` | `/cutting-room/posters/<id>.jpg`, 640x360 for new records; every card is 16:9 |
| `posterLarge` | video only: `/cutting-room/posters/<id>-1280.jpg`, 1280x720, the hero's sharp copy (`srcset`) and the player's poster |
| `still` | portrait video only: `/cutting-room/posters/<id>-still.jpg`, 9:16 (at most 720x1280), the player's poster before play |
| `cover` | audio and packs only: `/cutting-room/covers/<id>.jpg`, 600x600 |
| `art` | `frame`, `triptych` or `type`; audio and packs always get `type` |
| `width`, `height`, `fps` | video only. `audio` still means "has sound" |
| `transcript` | dialogue for video, lyrics for songs, every item's text for a pack (search reads it without loading the list) |
| `download`, `downloadSha256`, `downloadBytes` | an original kept beside the web file (a WAV beside its MP3) |
| `count`, `groups`, `groupLabel` | packs: items, group names in order, and what they are (Voice, Character, Agenda, Room, Song, Family, Film) |
| `aliases` | other ids that open this record (the Video Studio shot ids) |
| `featured` | the hero; one video at most. Otherwise the hero is the first Current edit video |
| `related` | ids: a film and its song link to each other ("Watch the film", "Hear the song") |
| `replaces`, `replacedBy` | a new cut and the Earlier version it replaced (which drops its transcript: the new cut carries it) |

Ids stay `slug(title)-sha8` from the file's sha256. A pack list names its own id, so a pack's eight
hex digits come from its list with the id left blank (`packDigest`); its `sha256` and `bytes` are the
list file's, like any other file. Lists are written by `packJson` (fixed key order, one item per line),
so the same items always give the same bytes:
`{v:1, id, title, groupLabel, items:[{n, text, src, duration, group, bytes, sha256}]}`. Items point
at files where they already live (`/phrases/01.wav`), never copies. A list is fetched when its pack
opens and never bundled. Write `catalog.json` with `writeCatalog` so it stays byte-compatible with the
Python writer (ASCII escapes, durations as floats) and a diff shows only what changed.

**Links.** `#<id>` or `#<alias>` opens a record; `#<pack id>/12` opens a pack on row 12, cued but not
playing. The page listens for `hashchange`, so links inside the page (related records) work too.

**Art for audio and packs.** Peg Board type on board black, never green, at one pitch per format
(5 px on a card, 8 on a cover): a title that will not set in PEG-9 at that pitch is refused, never
shrunk, so say it in fewer letters with `--cover-text`. The second line is always PEG-5 on one line;
"made in" values have short forms (AARON, CLAUDE CODE, MEETING ROOMS, CUTTING ROOM), and any other
line too long loses words from the end. A song's band is its own loudness; a pack's is one block per
item, as large as the band allows, so five takes fill it as fully as 294. On a card, the kind chip and
the duration sit over the bottom 40 px of the poster and the shortlist button over its top-right
48 px, so type art keeps both clear.

**Just made** lists the four newest records by `added`, after the hero and without cuts a newer one
replaced, so nothing on screen above the grid repeats.

**Players.** Video plays in the dialog as before (portrait films pillarboxed on black, their 9:16
`still` as the poster before play). A song gets
its square cover above a native audio player, with Media Session metadata. A pack opens as a list:
search, a group select, Play all, one shared `<audio>` for every row, the playing row lit in signal
yellow; closing the dialog stops it.

`node scripts/check-cutting-room.mjs` checks all of this, from every record's fields and file hashes
to the page in headless Chromium at 1440 and 390 px; `--static` skips the browser.

## Publishing

Every film, song or sound made for the site, here or on the Mac, goes into the library through one
command. It needs ffmpeg and `npm install`; run it from the repository root.

```bash
node scripts/publish-to-cutting-room.mjs <file> --title T --category C --made-in M --description D [options]
```

What it does, in order:

1. **Probes the file**, and stops with `unchanged: <id>` if the catalog already has it (the same
   file, or the same source: an encode records its source's sha256 in `sourceReference`).
   Publishing the same file twice changes nothing.
2. **Encodes only when it must.** A video that is H.264 with AAC, 4:2:0, fast-start and 25 MiB or less
   is kept as it is. Anything else gets a two-pass x264 encode to 25 MiB, the short side 1080, 720 or
   540, whichever first gives 0.05 bits per pixel per frame. Its AAC sound is copied untouched (a
   second AAC generation overshoots: it once took DELVE. from -1.3 to +1.3 dBTP), and its real bitrate
   comes out of the picture's budget; other sound becomes AAC 192k through a 4x-oversampled limiter,
   measured and limited again until it is under. MP3 is never re-encoded (that would void a measured
   true peak). WAV, FLAC and AIFF become MP3 320k; other lossy audio becomes MP3 192k, and the
   original is kept as the download.
   **A film's sound is measured as it ships** and must stay under its ceiling: -1 dBTP (the house
   standard), or -0.1 dBTP for a film scored with one of Aaron's own tracks (`--related` to one), whose
   master keeps his peaks. Over it, the command stops before writing or uploading anything: fix the
   master as the film's brief says and publish again, or pass `--limit-sound` to put even AAC through
   the limiter (the picture of a web-ready file is copied as it is).
3. **Hashes and measures** the web file: sha256, bytes, duration, size, frame rate.
4. **Files it** as `public/cutting-room/{films,songs,sounds}/<slug>-<sha8>.<ext>`. A file already in
   `public/` stays where it is and is referenced there. An existing name is never overwritten.
5. **Makes the art**: a frame or a triptych for video (`--poster-frames`, `--poster-at`, `--poster`) at
   640x360 and 1280x720 (`posterLarge`), plus a 9:16 `still` for a portrait film (the triptych's
   middle frame); Peg Board type art for audio and packs (`posters/<id>.jpg` 640x360 and
   `covers/<id>.jpg` 600x600).
6. **Puts the record on top** of `catalog.json` and refreshes `updated` and `cast`.
7. **Runs `check-cutting-room.mjs --static`.** If it fails, the catalog and every file written are put
   back as they were. It then prints the catalog's weight: `catalog.json` is bundled into the page, so
   its budget is 64 KB gzipped (what a visitor downloads; about 35 KB with 185 records).

`--dry-run` does the work in a scratch folder and prints the record without writing anything.
`node scripts/publish-to-cutting-room.mjs --help` lists every option.

**A film.** Day One. went in like this (the cloud render was already web-ready, so it was copied
as it is):

```bash
node scripts/publish-to-cutting-room.mjs day-one.mp4 --title "Day One." --category "Finished films" \
  --made-in "Claude Code films" --featured --poster-frames 0,2880,3527 --related day-one-score-8a5a8f4a \
  --description "Jamie starts her first job. A thousand strangers tap Congrats on the new role! One of them calls her Jordan."
```

**A song.** A WAV becomes MP3 320k; `--download` keeps the original beside it, byte for byte:

```bash
node scripts/publish-to-cutting-room.mjs printer-song.wav --title "Printer Song (original track)" --category Songs \
  --made-in "Aaron's tracks" --download printer-song.wav \
  --description "Aaron’s original. No lyrics. The printer handles the vocals."
```

A parenthesis in the title becomes the cover's second line ("Circle Back (Drop Edition)" sets as
CIRCLE BACK over DROP EDITION); otherwise it says where the song was made. `--cover-text` and
`--cover-sub` override both, and a `|` in the text is a line break. Lyrics go in with
`--transcript lyrics.txt`. `--added` is the day the piece was finished (default today): the four
newest show under the hero as Just made.

**A pack.** `scripts/cutting-room-packs.mjs` knows the ten packs: which files, the words on each row
(from the manifests that made them) and the record's copy. It writes a pack's list and prints the
command that files it:

```bash
node scripts/cutting-room-packs.mjs --list
node scripts/cutting-room-packs.mjs voice-bank --out /tmp/packs --replaces all-hands-voice-bank-314642fe | sh
```

A list is `[{file, text, group, name?}]`. Items already in `public/` are listed where they are;
others are encoded to MP3 (`--item-bitrate`, 128k by default) under `sounds/<--items-dir>/`. The
instruments are rendered first, in headless Chromium: `node scripts/render-instrument-pack.mjs --out DIR`
(one hit of every voice in `src/allhands/instruments.js`, each tuned kick with its song's tuning, and
the tambourine shake at three velocities; MP3 160k), then
`node scripts/cutting-room-packs.mjs instruments --out /tmp/packs --instruments DIR`. A pack's id comes
from its list, so a changed pack is a new record: republish it with `--replaces`.

**Art again.** `--refresh-art <id>` draws a published record's art again with today's code (after
the art changes): the poster, `posterLarge` and `still` of a film (pass its `--poster-frames` again),
or the poster and cover of a song or pack (its `--cover-text` and `--cover-sub`). The media file and
the id never change; the art files are the record's own, so they are rewritten in place.

**A new cut.** `--replaces <id>` makes the new file inherit every field it is not given. The old
record becomes an Earlier version with `replacedBy`, keeps its file and its link, and hands
`featured` and `related` to the new one (records that pointed at it point at the new cut).

**R2.** `--r2` uploads the web file to the bucket through the site's media router instead of the
repository: `PUT /api/cutting-room/media/<slug>-<sha8>.<ext>` with `CATALOG_UPLOAD_TOKEN` from the
environment (it is never written anywhere), `--base` defaulting to https://linkedinbeats.com. There
is no 25 MiB cap (a video that needs an encode gets CRF 18, at most 300 MiB). The poster stays in the
repository. Audio keys (`.mp3`, `.m4a`) need the `server/cutting-room.js` that accepts them deployed
first: until then the server answers 400 and the command says so.

**Not here:** the Video Studio proxies (rebuilt by `scripts/build-videostudio-proxies.mjs`), the
`assets/` masters (each duplicates a web file already in the catalog), the optimizer's robot voice
cache (a stock system voice), superseded takes, the YouTube catalog and user beats.

`scripts/build-cutting-room-catalog.py` predates the library: it rewrites `catalog.json` from a
recovered workspace and would drop every record published since. Do not run it over the current
catalog.

`catalog.json` is the browsable metadata. `scripts/build-cutting-room-catalog.py` regenerates it and posters from a recovered workspace. Original source hashes and task IDs are retained where available. 152 records were recovered on October 20, 2026, including earlier versions and source masters. This is not a claim that every unreferenced historical Runway generation has been recovered or frame-by-frame approved.

## Character continuity

Synergy and Synthia use the approved ivory/chrome designs and readable name badges. The black face screen contains two green eyes and a fixed-height horizontal mouth row. Speech brightness scrolls left to right; never vertically expands or warps the metal. Humans need small natural movements, attached mouths, and the matching voice. Printer pages travel outward onto a supported surface. Droid size must remain consistent.

## Current film

V6 restores the sign-installation arrival, printed banner setup, and measuring. It keeps the existing 720p music/dialogue mix, ends on the office applause, and omits the end card and tagline. No new Runway generation was used.

The Circle Back correction adds a 153rd record. Only Synergy's tile uses the
approved camera v2 footage and tracked horizontal speech row. The full 90-second
soundtrack is packet-identical to the original. Other cameras and speaker borders
retain their original pixels before delivery compression. The older cut remains
available under Earlier versions. Rebuild with `scripts/recut-circle-back-synergy.py`;
production checks are in `assets/film-corrections/circle-back-synergy/edit-proof.json`.

Training 02: Caffeinated Edition adds a 50-second current edit and two reusable
Synergy performance plates. The original training remains under Earlier versions.
The recut has an original jazzy beat, approved digital voice, fast ChatGPT typing,
coffee cups and a tracked horizontal speech display. Rebuild instructions are in
`scripts/training_02/README.md`; continuity and delivery checks are in
`assets/film-corrections/training-02/`.

## Synergy corrections — 20 October 2026

The masterclass recut uses the approved caffeinated desk and close-up plates, a two-second blink/reflection insert, tracked typing footage, and a clean post-and-camera composition. Its 44-second soundtrack remains packet-identical to the original. The saved compositor is `scripts/recut-masterclass-synergy.py`; run from the workspace with the documented Training 02 source plates and tracking files.

One Mind, Many Perspectives replaces only Synergy's camera interior with the approved studio v2 plate. The original labels, active-speaker borders, other eleven tiles and corrected audio remain. The fixed-height speech row scrolls sideways and follows the original active-speaker cue. The renderer checks unchanged pixels outside the tile before encoding and verifies copied AAC packets. See `scripts/recut-one-mind-synergy.py` and the corresponding `assets/film-corrections` reports. Both corrections reuse existing media and use zero new Runway credits.

## Recent films — 28 October 2026

As of October 28, 2026 (before the library, which now puts its newest records on top), the first two catalog entries were Moving Things Forward (60 seconds, refined paper-droid song with clearer voice, robotic beeps and undercarriage repair) and Optimizing — pocket mix (40 seconds, approved mechanical printer picture with the latest 84 BPM soundtrack alternate). Both are Current edits under Finished films; searchable transcripts and frame-derived posters are included. The mistaken humanoid-droid draft and superseded repair exports are excluded.

These two small delivery masters are versioned under `public/cutting-room/films/` and use the existing static-media delivery path. Filenames include the first eight SHA-256 characters; the catalog records the full hashes, sizes and source dimensions. The older externally stored catalog originals retain their existing URLs. The hero has since moved to the `featured` record (Day One.), or else the first Current edit video: see One library, above.
