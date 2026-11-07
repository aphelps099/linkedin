# Day One

A film for LinkedIn Beats. 58.8 seconds, 9:16, 60 fps, one LinkedIn post seen as a phone screen recording.

## The idea

Jamie got her first job. She posts it the way everyone does: "Thrilled to share that I'm starting a new position as Associate Coordinator, Revenue Enablement at Brightwick!" The first comments are from her people: the bakery she worked at, her mom, her old shift lead, the company's people team. Then the network notices. "Congrats on the new role!", the reply the app suggests with one tap, arrives from a thousand people she has never met. Someone calls her Jordan. A recruiter offers her a senior role on her first day. A vendor pitches her. Someone taps the wrong suggestion and congratulates her on five years at a company she has not started at. She thanks everyone. One more person writes "Congrats on the new role!"

The film is one white post card with the comments rising like a credit roll. The sentence is the constant and the people are the variable: when every row says the same thing, the rows line up into a typographic pattern, a ladder of grey bubbles with the same five words at the same x and a column of identical grey discs beside them, and the camera pulls back so the pattern fills the frame. Nothing is drawn over the interface. The pattern is made of the app's own grid.

Believability comes from anatomy, hierarchy, spacing, microcopy and rhythm, matched to the UI study: the social context line, the 48 px lockup with "(She/Her) • 2nd", the grey headline, "1d • " and a globe, "…more", the reaction cluster and "1,204 comments • 18 reposts", the four-button bar, the composer, the suggested replies, "Most relevant", the grey comment bubbles with name, headline, time and "Like · 14 | Reply · 1 reply", "Load more comments", "(edited)", pronouns, the Author pill, #Hiring and Open to Work frames. We draw our own icons, ship no logo, wordmark or icon artwork, and never write the word "LinkedIn". Everyone is invented, and every name passed a Wikipedia exact-title check.

## The picture

- **Page:** 360x640 CSS px at deviceScaleFactor 3 (1080x1920), 60 fps. It is a screen recording: the phone's status bar (44 px: the time, signal, Wi-Fi, battery) and the app's top bar (56 px: a back chevron, nothing else) sit at the top at scale 1, and the home indicator at the bottom. Both bars are our own drawing, with no app name. Under them, 8 px of feed grey, then the card. Below the last comment the page stays white, as the app's post view does.
- **Safe band:** the two bars fill the top 300 frame px, so the counter, the context line and every comment sit inside the project's 9:16 safe band (`src/pegboard/font.js` FORMATS['9:16'].safe, y 300 to 1440), clear of the Reels, TikTok and Shorts header. The last frame's punchline (Doug's line) ends at about 1,360 frame px; only his "Like · Reply" and the closing "Load more comments" sit below the band, as the app's own chrome would.
- **Type:** the system stack the app uses (`-apple-system, system-ui, ...`): SF Pro on the Mac, Inter in the cloud container. Weights 400 and 600, sizes 12 and 14 (the status bar's clock is the phone's, 15/600). Text rgba(0,0,0,.9), secondary .6, mentions #0A66C2. Never green type.
- **The pinned counts row (the one liberty):** when the counts row reaches the top bar it pins under it, 34 px, white with a hairline, and stays at scale 1 through the pull-back. The climbing counter is the film's clock; it stays legible (12 CSS px, 36 frame px) at the wall, where it climbs fastest. The action bar scrolls away with the card.
- **Camera:** a(t) is the content y on the reading line (y = 300, 900 frame px), k(t) the scale about it. a(t) comes from row tops measured after the fonts load, so SF Pro and Inter both land on the beat. Segments: hold; the warm block, read (minimum-jerk moves from rest to rest with holds: Dana and Jamie's reply, then Mom, "Mom 😭" and Tess, then a full stop on "Load more comments" with Nadia above it); linear inside a wave (a credit roll); an exponential settle into each special row (tau 0.25 s) that becomes a 6 px/s creep while it dwells; a one-beat eased launch out of it; a smooth stop with Jamie's comment at y 270.
- **Speed limit:** no content point in view moves faster than 390 CSS px/s, which is 6.5 CSS px (19.5 frame px) a frame at 60 fps. No motion blur: this is a screen recording.
- **Avatars:** 57% the default silhouette (warm grey ground, blue-grey figure), the one-tap crowd, Doug and the anniversary comment among them. Then the pictures people use when they do not use a headshot, matched to their headlines where they can be: people seen from behind (at an office window, in a park, on a trail, on a summit), a camera operator from behind, hands on keys or a fretboard, drumsticks, clapping hands (close crops of our own Office and Instrument footage with `faceBox` null and no face in the box, never Pat), a sunset, a skyline, a green, graduation caps, a sailboat, a peony (Mom, and Terri), a latte (Tess), and three small-business marks for the owners whose headlines name a business (a loaf for Dana's bakery, a leaf for Dumont Landscaping, a ramp-and-light for Ramplight). Never initials. No picture is used more than twice or twice within 16 rows, so no two identical pictures are ever on screen together. Jamie's is a portrait from behind at a sunlit window, her hair up, an oatmeal sweater, drawn at 288 px so her 48 px lockup is sharp. Frames: Open to Work green (Shayla, Tanya) and #Hiring purple (Kyle, Yuki, Carly, Lindsey, Whitney), a crescent at 7:30 tapering to nothing at 12 and 3, with our own white letter-rhythm dashes along it (never legible).
- **Reaction discs:** like, celebrate, love, insightful in our own flat white glyphs (Celebrate is two palms meeting in a V under a three-tick burst), stacked with the leading reaction on top and every glyph inside the central 10 px, so the 4 px overlap only ever covers a rim.

## The timeline

100 BPM: a beat is 0.6 s (36 frames at 60 fps), an 8th 18 frames, a 16th 9, a bar 2.4 s. B is the beat from 0; frame = 36 x B. "On the line" means the row's top edge is on the reading line.

| B | t (s) | Frame | Picture | Sound |
|---|---|---|---|---|
| 0 | 0.0 | 0 | The thumbnail: status bar and top bar, the post clamped to 3 lines with "…more", 47 reactions, "12 comments" (reposts hidden at 0). The composer, the suggested replies and Dana's comment below. | Rhodes alone, Bm9 |
| 2 | 1.2 | 72 | "…more" opens; the text reflows to full length, no animation. | |
| 4 to 7.5 | 2.4 to 4.5 | 144 to 270 | The reaction burst on 8ths: 47 to 64. | 8 soft ticks |
| 8 | 4.8 | 288 | The roll starts. The counts row pins under the top bar at about B9.7. | Bass, soft kick |
| 11 to 12.5 | 6.6 to 7.5 | 396 to 450 | At rest: Dana's comment and Jamie's reply ("morning buns"). | Chorus guitar |
| 15.5 to 16.75 | 9.3 to 10.05 | 558 to 603 | At rest: Mom ("Love, Mom") and Jamie's "Mom 😭", Tess under them. | |
| 20 | 12.0 | 720 | "Load more comments" settles on the line (a full stop), Nadia's "Your laptop is ready" above it. | |
| 21 | 12.6 | 756 | Pressed: #EBEBEB for 8 frames, then a 20 px spinner. | Everything stops but the Rhodes |
| 22 | 13.2 | 792 | Rows 7 to 9 appear where the button was, row 7 on the line. The comment counter starts, on 8ths. | Voice 1: S1, alone, dry |
| 26 | 15.6 | 936 | **"Congrats, Jordan!"** (row 10) dwells to B28. 41 comments. | Four on the floor from B24 |
| 29 to 32 | | | Wave 2, rows 11 to 14, one a beat. | S2, then Synthia's Y1 |
| 34 | 20.4 | 1224 | **The recruiter** (row 15, #Hiring frame) dwells to B37. "96 comments • 1 repost". | Claps on 2 and 4 |
| 38 to 39.5 | | | Wave 3, rows 16 to 19, on 8ths (380 px/s). | x3 |
| 40 | 24.0 | 1440 | The cluster flips to Celebrate, Like, Love. | |
| 41 | 24.6 | 1476 | **"So well deserved!"** (row 20) dwells to B42. | Pad |
| 43 to 46.5 | | | Wave 4, rows 21 to 28. | x4 |
| 48 | 28.8 | 1728 | **"Let's connect!"** (row 29, Open to Work frame) dwells to B49. The counter lands on **340**. | Accent tick, clap, Rhodes stab |
| 50 to 53.5 | | | Wave 5, rows 30 to 37. | x6 |
| 55 | 33.0 | 1980 | **The vendor** (row 38, two lines) dwells to B59. | |
| 60 to 68.5 | 36.0 to 41.1 | | Waves 6 to 8, rows 39 to 56 on 8ths. From about B61 to B63.5 every row in frame is the same sentence: the pattern at 1x. 👏👏👏 (row 49) passes at B65, "Insightful" (row 53) at B67, no dwell. | x8: the 8th-note canon from B60, with the identical rows |
| 70 | 42.0 | 2520 | **The anniversary** (row 57, Darren Whitcomb): "Congrats on 5 years at Brightwick!" dwells to B73. 911 comments. | Choir choked |
| 71 to 76 | 42.6 to 45.6 | 2556 to 2736 | The pull-back, k 1 to 0.45 (sine in-out), starting under the anniversary's dwell so it shrinks into the top of the column. The counts row stays full size. | |
| 74 to 81.5 | 44.4 to 48.9 | 2664 to 2934 | **The wall:** rows 58 to 73 arrive on 16 consecutive 8ths. Held at 0.45 from B76 to B82: a white column of identical rows on feed grey under a full-width counter. The counter jumps on 16ths. | 16-entry canon, the peak |
| 82 to 88 | 49.2 to 52.8 | | The push back in (to k 1 by B85.5) while wave 10 (rows 74 to 78) slows; Terri's "Congratualtions!!" ("41m (edited)", row 79) comes to rest just above Jamie. | The choir thins |
| 88 | 52.8 | 3168 | **Jamie's comment** (row 80, Author pill) comes to rest at y 270: "Thank you all! 🙏 First day tomorrow." 1,203. The roll stops. | Gmaj9, left to ring |
| 91 | 54.6 | 3276 | | Choke to digital silence |
| 92 | 55.2 | 3312 | Doug's reply appears under Jamie's: "Congrats on the new role!" **1,204.** Jamie's comment reads "Reply · 1 reply"; "Load more comments" under it. | The 1,204 tick, then 67 ms later S1 again, dry, the identical samples |
| 98 | 58.8 | 3528 | End. The last frame (3527) has been held since B92. | Silence after the voice |

The counter's landmarks (comments, reactions, reposts): 12/47/0 at B0, 64 reactions after the burst, 41/118/0 at B26, 96/260/1 at B34, 187/488/2 at B41, **340**/1,126/4 at B48, 512/1,690/6 at B55, 688/2,214/8 at B62, 803/2,560/10 at B65.5, 911/2,931/12 at B70, 1,140/3,604/16 at B83, 1,203/3,851/18 at B88, **1,204**/3,862/18 at B92. Between them the numbers jump once per 8th (once per 16th through the wall), unevenly, seeded, never by zero, and every change on screen has a tick (`timeline.js` `ticks()`, 158 of them).

## The comment script

`src/films/day-one/script.json` (from the copy study, the company templated). The rows that are not uniform wave rows:

| Row | Who | Headline | Time | Comment | On the line |
|---|---|---|---|---|---|
| 1 | Dana Whitfield (She/Her) • 2nd | Owner at Second Rise Bakery / Bread, coffee and good people | 1d | We'll miss you on the 6am bake. Brightwick has no idea how lucky they are. Proud of you, kid. | at rest B11 |
| 2 | Jamie Okafor (She/Her), reply, Author pill | Associate Coordinator, Revenue Enablement at Brightwick / Merrow State '26 | 1d | Dana!! I'll still come in for the morning buns ❤️ | at rest B11 |
| 3 | Rose Okafor • 3rd+ | Retired School Nurse | 1d | So proud of you sweetheart!!! ❤️❤️ Love, Mom | at rest B15.5 |
| 4 | Jamie Okafor, reply, Author pill | | 1d | Mom 😭 | at rest B15.5 |
| 5 | Tess Moreno • 3rd+ | Shift Lead at Second Rise Bakery | 1d | who is going to fix the espresso machine now 😭😭 congrats @Jamie Okafor!! | at rest B15.5 |
| 6 | Nadia Ferrante • 2nd | People Partner at Brightwick | 23h | Welcome aboard! 🎉 Your laptop is ready. | B20 (above Load more) |
| 10 | Gregory Pham • 1st | Regional Sales Manager at Copperline | 22h | Congrats, Jordan! | B26 |
| 15 | Kyle Henshaw (He/Him) • 3rd+, #Hiring frame | Senior Talent Partner at Kestrel Ridge Talent / Placing GTM Leaders in SaaS / #Hiring | 19h | Love this! Open to a quick chat about a Senior role? | B34 |
| 20 | Devon Marchetti • 3rd+ | Keynote Speaker / Bestselling Author / Helping Founders Build Personal Brands That Convert | 16h | So well deserved! | B41 |
| 29 | Shayla Kim (She/Her) • 3rd+, Open to Work frame | Open to Work / Marketing & Communications / Merrow State '25 | 12h | Let's connect! | B48 |
| 38 | Brett Lorimer • 3rd+ | Account Executive at Ramplight / Helping Revenue Teams Ramp Reps 3x Faster | 9h | Congrats Jamie! Ramplight cuts rep onboarding 41%. 15 min next week? 🚀 | B55 |
| 49 | Gail Ostrander • 3rd+ | Proud Merrow State Alum | 6h | 👏👏👏 | B65 |
| 53 | Neil Varma-Hollis • 3rd+ | Futurist / AI Evangelist / Web3 / Keynote Speaker | 4h | Insightful | B67 |
| 57 | Darren Whitcomb • 3rd+ | Operations Manager at Tallis Freight | 2h | Congrats on 5 years at Brightwick! | B70 |
| 79 | Terri Lynn Baxter • 3rd+ | Retired Realtor / Proud Grandma of 6 | 41m (edited) | Congratualtions!! | rests above Jamie |
| 80 | Jamie Okafor (She/Her), Author pill | Associate Coordinator, Revenue Enablement at Brightwick / Merrow State '26 | 6m | Thank you all! 🙏 First day tomorrow. | B88 |
| 81 | Doug Halvorsen • 3rd+, reply | Regional Account Manager | 1m | Congrats on the new role! | appears B92 |

- **Wave 1** (rows 7 to 9): Rachel Imbert, Sunil Varghese, Megan Kostas.
- **Wave 2** (11 to 14): Derek Fenwick, Alana Brooks-Ito, Emeka Nwosu, Lauren Pike.
- **Wave 3** (16 to 19): Haruto Saito, Bianca Ferreira, Caleb Strand, Ines Duarte.
- **Wave 4** (21 to 28): Rohan Mehta-Rao, Sofia Lindgren, Danielle Yoon, Rob Castellanos, Fatima Haddadi, Greg Ostrowski, Yuki Takabe (#Hiring), Nicole Brandvold.
- **Wave 5** (30 to 37): Andre Whitaker, Leah Goldfarb, Samuel Adeyemi, Courtney Rask, Vikram Iyer, Erin McAllister, Diego Paredes, Hannah Sobczak.
- **Wave 6** (39 to 48): Wade Tolliver, Kayla Dimitrov, Ben Achterberg, Rosa Quintero, Trevor Lindahl, Mei-Ling Cho, Jason Pruitt, Olivia Haskins, Rahul Bhandari, Stephanie Kerr.
- **Wave 7** (50 to 52): Luis Bautista, Carly Westover (#Hiring), Grace Obi. **Wave 8** (54 to 56): Zara Siddiqui, Scott Dumont, Jessica Tran.
- **Wave 9, the wall** (58 to 73): Ibrahim Karaca, Molly Brennick, Eli Navarrete, Renee Castillo, Adam Wierzbicki, Tanya Morales (Open to Work), Hiro Matsunaga, Brooke Delaney, Omar Haidari, Lindsey Graff (#Hiring), Chris Mbatha, Paige Holloway, Sanjay Kulkarni, Kelsey Ward, Felipe Aranda, Monica Strauss.
- **Wave 10, slowing** (74 to 78): Lamar Greene, Dmitri Arkhipenko, Whitney Cole (#Hiring), Tariq Benali, Jenna Hartley.

Wave rows are uniform: a one-line headline, "Congrats on the new role!", "Like | Reply", no pronouns, no counts, pitch exactly 114 px. The times run from 1d down to 1m, but "Most relevant" is not chronological: a few in every wave sit far out of sequence (a 1d in the 7h wave, a 4h among the 21h), and about one in four trades with its neighbour.

## The one command (on the Mac)

```
cd linkedin
npm install                        # once; then, once: npx playwright install chromium
node scripts/render-day-one.mjs --out out/day-one --stills
node scripts/check-day-one.mjs --dir out/day-one
```

The render starts its own Vite server, opens Chromium at 360x640 @3, waits for the page (fonts measured, avatars decoded), logs the font each kind of text resolves to (it should read SF Pro, "SF NS" or "System Font"; here it reads Inter), renders the score offline (`score.js`, 48 kHz stereo), captures 3,528 frames into ffmpeg and muxes. It writes `day-one.mp4` (H.264 High level 4.2, CRF 14, yuv420p, BT.709, 60 fps CFR, AAC 320k 48 kHz, faststart), `day-one.wav`, `timeline.json`, `contact-sheet.png` and, with `--stills`, the key beats at full size. About 6 minutes here (90 ms a frame for 3,528 frames, plus about 24 s for the score); `--preview` renders 540x960, faster.

Options: `--company Name` (default Brightwick), `--from s --to s` (a span), `--preview` (540x960), `--channel chrome` (the installed Google Chrome instead of Playwright's Chromium), `--audio FILE` (mux a finished mix instead of rendering the score), `--silent`, `--frames 0,792,3312` (stills only, for review; 60 fps frame numbers), `--remux` (keep the rendered picture in `--out`, render the score again or take `--audio FILE`, and mux it: for when only the sound has changed).

## Review checklist

Run `node scripts/check-day-one.mjs --dir out/day-one` (add `--compare out/day-one-2` after a second render for run-to-run determinism). It checks, and a person then looks:

1. **Format:** 1080x1920, 60/1 CFR, 3,528 frames, H.264 High (level 4.2) yuv420p BT.709, AAC 320k 48 kHz, faststart, audio and video within a frame.
2. **Determinism:** a frame seeked on its own in a fresh page matches the frame rendered in sequence, byte for byte; two runs give identical PNG hashes and identical WAVs.
3. **Sync:** 340 first shows at frame 1728 (B48) and 1,204 at 3312 (B92); every counter change has a tick within a frame; the 16 wall rows and every wave and special row arrive within a frame of their beats; Voice 1's "grats" within a frame of B22; the last line starts 0 to 100 ms after Doug's reply.
4. **UI lint at 12 sample times:** weights 400/600, sizes 12/14 (the status bar's clock 15), every colour a token, no green type, "…more" with U+2026, counts lowercase, comma-formatted, pluralised ("1 repost"), degrees " • 1st/2nd/3rd+", no time older than "1d", the word "LinkedIn" nowhere, no path from LinkedIn's reaction SVGs shipped, no initials avatars.
5. **Copy:** Brightwick everywhere, never Brightwell; the anniversary comment an ordinary member; the typo just above Jamie; no name a Wikipedia title (`scratchpad/dayone/fin/name-check.json`, made by `fin/namecheck.py`).
6. **Pattern:** uniform rows pitch exactly 114 px; row 7 replaces "Load more comments" at the same y.
7. **Legibility:** each special row is on screen, at or above the reading line, for its dwell; each warm comment is wholly in view for at least 2 s with at least 1 s at rest; the reading time of every joke is reported. At phone size (390 px wide) the jokes read: Jordan, the recruiter, "So well deserved!", "Let's connect!", the vendor, the anniversary, the typo.
8. **Camera:** no content point in view moves faster than 390 px/s (6.5 CSS px a frame).
9. **Canon:** flashes at most 3 a second, whole frame and quadrants (`src/pegboard/governor.js`); no faces, no Pat; 55 to 62% silhouettes, no picture twice within 16 rows; green only as a frame, a disc or a mark, never type; no Zoom or Lite-Brite marks.
10. **Audio:** -10 +/-0.5 LUFS, true peak <= -1 dBTP, digital silence B91 to the last line and on the tail. The null test of the final S1 against Voice 1 and the Whisper test are the sound's checks (`scripts/measure-day-one-sound.py`).
11. **On the Mac:** the font log reads SF Pro, and checks 1 to 10 pass on that render too.

By eye: the first frame reads as a real screen recording of a post you would scroll past; nothing jumps when the counts row pins or when the rows replace the button; the warm comments are read, not rolled; the wall reads as a pattern under a counter you can still read; the anniversary sits at the top of the column when the pull-back lands; the last frame holds Terri's typo, Jamie's thanks and Doug's reply, and nothing else moves; the reply appears, the tick sounds, then the voice.

## Measured (the Inter render in the cloud container, 7 Nov 2026)

- **Checks:** `check-day-one.mjs` 47 passed, 0 failed (2 notes: the font, and the reading times below). `check-songbook.mjs` 22,450 passed; `check-allhands.mjs` 3,795 passed; `measure-day-one-sound.py` every gate passes.
- **Format:** 1080x1920, 60/1 CFR, 3,528 frames, H.264 High level 4.2 yuv420p BT.709, AAC 320k 48 kHz, faststart, audio and video both 58.800 s.
- **Determinism:** 15 frames seeked alone, out of order, in a fresh page match the render byte for byte; a second render of B66.7 to B78.3 (420 frames: the anniversary, the pull-back, the wall) matches frame for frame; two renders of the score give the same WAV (sha256 679960a5…).
- **Sync:** 340 first at frame 1728 (B48), 1,204 at 3312 (B92); all 158 counter changes have a tick within a frame; every wave and special row, and the 16 wall rows, arrive within a frame of their beats; Voice 1's "grats" on B22 to the sample; the last line starts 66.7 ms after Doug's reply and its tick ("grats" 437 ms after).
- **Speed:** the fastest point in view moves 6.47 CSS px (19.4 frame px) a frame, at frame 2665 (the pull-back meets the wall).
- **Reading time** (wholly in view at k > 0.95 / at rest): Dana 2.37/1.43 s, Mom 2.23/1.28 s, Tess 2.60/1.28 s, Nadia 2.92/1.55 s; Jordan 3.92/1.95 s, the recruiter 4.22/2.58 s, "So well deserved!" 2.57/1.23 s, "Let's connect!" 2.57/1.23 s, the vendor 4.25/3.00 s, the anniversary 2.42/1.67 s (then readable as it shrinks at the zoom's centre), 👏👏👏 and "Insightful" 1.07 s each in passing, the typo and Jamie's thanks 7.90/7.05 s.
- **Flashes:** none, whole frame or any quadrant; luminance stays between 0.856 and 0.940, the largest frame-to-frame step 0.069.
- **Audio:** -10.1 LUFS integrated, true peak -1.6 dBTP (the AAC track -10.1 LUFS, -1.3 dBTP), no clipping, loudness range 5.9 LU. The wall is +2.97 LU over bars 12 to 16 (+3.64 through the phone filter). Digital silence from B91 to the 1,204 tick (0.600 s) and from 56.936 s to the end; the final S1 is sample-identical to Voice 1.
- **Whisper small.en:** hears all five words of the motif in every window. The last line, alone after the silence, reads "Congrats on the new role!" literally in 4 of 5 windows of the mix (2 of 4 in the delivered mp4's AAC); Voice 1 at B22, over the Rhodes, is spelled "roll" in every window. "Role" and "roll" are the same sounds (R OW L), and the gate counts the homophone, as the voice bank does.
- **Names:** all 79 names on screen (every commenter, the author, the context line) checked as exact Wikipedia titles, with redirects: no hits.

## What differs from the build spec

- **Company:** Brightwick everywhere (Aaron's decision), switchable with `--company`.
- **60 fps,** not 30: at 30 the roll moved type 38 frame px a frame (more than an x-height), which strobes on a phone and does not look like a screen recording. At 60 every beat, 8th and 16th is a whole frame (36, 18, 9). The speed limit is the same 390 px/s.
- **The frame is a screen recording:** a status bar and a top bar (100 CSS px) of our own drawing, so the counter sits inside the 9:16 safe band, and the counts row (not the action bar) pins under them, at scale 1 through the pull-back.
- **The warm block is read:** Dana (and Jamie's reply), Mom (and "Mom 😭"), Tess (now tagging Jamie) and Nadia, each at rest for at least a second, instead of eleven comments at 289 px/s. Cut: Priya, the professor, the boss, Aisha and Owen.
- **Longer dwells:** the recruiter to B37 (wave 3 is four rows, B38 to B39.5); the vendor, now two lines, to B59 (waves 6 to 8 start at B60 and are 18 rows; the canon moves with them to B60).
- **The anniversary comment** is an ordinary member, Darren Whitcomb, who tapped the suggested work-anniversary reply, not "LinkedIn Member": the word "LinkedIn" now appears nowhere.
- **Names:** the study's Priya Raman, Adam Wójcik and Hiro Matsuda were names of notable people; a Wikipedia exact-title check of every name found six more (Eli Navarro, Dmitri Arkhipov, Fatima Haddad, Ibrahim Kaya, Molly Brennan, Yuki Tanabe). Priya's row is cut; the rest are Adam Wierzbicki, Hiro Matsunaga, Eli Navarrete, Dmitri Arkhipenko, Fatima Haddadi, Ibrahim Karaca, Molly Brennick and Yuki Takabe. Rose Okafor and Rohan Mehta-Rao, as the spec proposed, avoid the band's Linda and Arjun.
- **The typo** sits just above Jamie's thanks, so the last 7 seconds hold it; Lamar Greene takes its place after the wall.
- **The ending:** Jamie comes to rest at y 270, not on the line, so Doug's line ends above the safe band's bottom; the last line is placed by its first sample, 67 ms after Doug's reply and its tick, so picture, tick and voice come in that order after 0.67 s of silence.
- **"Load more comments"** also sits under the last reply from B22 (rows 7 and on), as in the app.
- **Pull-back:** B71 to B76 with a sine ease, not B73 to B76 cubic (the cubic broke the speed limit); the push back in runs B82 to B85.5.
- **The vendor's launch, the warm pace, Jamie's headline on her own comments, the comment time 40 px from the bubble's edge, "…more" at a word boundary, the second chip cut by the edge, white below the thread:** as before.

## For Aaron

- **The context line:** "Gregory Pham celebrates this" over a bare "47". The app writes "Gregory Pham and 46 others" when a connection reacted; that string does not fit the pinned row at "3,862 / 1,204 comments • 18 reposts". Keep it as it is (the line sets up "Congrats, Jordan!"), or drop the context line.
- **Pull-back depth:** 0.45 (about 10 rows, the sentence a texture under a legible counter), 0.33 (texture only), or a shallower 0.62 (the sentence still reads as words; recheck the speed limit).
- **The tail:** B92 to B98 holds the last frame for about 1.9 s of silence after the voice. B96 ends 0.7 s after "role!" (one constant, `BEATS`).
- **The pinned counts row,** the one structural liberty.
- **The suggested-reply chips** (they plant the flood; the real wording is unconfirmed).
- **The avatars:** 57% silhouettes, the rest pictures from behind, places, hands and marks. More silhouettes is the plainer alternative.
