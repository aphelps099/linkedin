# Day One

A film for LinkedIn Beats. 58.8 seconds, 9:16, one LinkedIn post.

## The idea

Jamie got her first job. She posts it the way everyone does: "Thrilled to share that I'm starting a new position as Associate Coordinator, Revenue Enablement at Brightwick!" The first comments are from her people: the bakery she worked at, her mom, her professor, her new boss. Then the network notices. "Congrats on the new role!", the reply LinkedIn suggests with one tap, arrives from two hundred people she has never met. Someone calls her Jordan. A recruiter offers her a senior role on her first day. The platform congratulates her on five years at a company she has not started at. She thanks everyone. One more person writes "Congrats on the new role!"

The film is one white post card with the comments rising like a credit roll. The sentence is the constant and the people are the variable: when every row says the same thing, the rows line up into a typographic pattern, a ladder of grey bubbles with the same eight words at the same x, and the camera pulls back so the pattern fills the frame. Nothing is drawn over the interface. The pattern is made of LinkedIn's own grid.

Believability comes from anatomy, hierarchy, spacing, microcopy and rhythm, matched to the UI study: the social context line, the 48 px lockup with " • 2nd", the grey headline, "1d • " and a globe, "…more", the reaction cluster and "1,204 comments • 18 reposts", the four-button bar, the composer, the suggested replies, "Most relevant", the grey comment bubbles with name, headline, time and "Like · 14 | Reply · 1 reply", "Load more comments", "(edited)", pronouns, the Author pill, #Hiring and Open to Work frames. We draw our own icons and ship no logo, wordmark or icon artwork. Everyone is invented.

## The picture

- **Page:** 360x640 CSS px at deviceScaleFactor 3 (1080x1920). 8 px of feed grey, then the card, full bleed. Below the last comment the page stays white, as the app's post view does.
- **Type:** the system stack LinkedIn uses (`-apple-system, system-ui, ...`): SF Pro on the Mac, Inter in the cloud container. Weights 400 and 600, sizes 12 and 14. Text rgba(0,0,0,.9), secondary .6, mentions #0A66C2. Never green type.
- **Camera:** a(t) is the content y on the reading line (y = 300, 900 frame px); k(t) the scale about it. a(t) comes from row tops measured after the fonts load, so SF Pro and Inter both land on the beat. Segments: hold, an eased start, linear inside a wave (a credit roll), an exponential settle into each special row (tau 0.25 s) that becomes a 6 px/s creep while it dwells, a one-beat eased launch out of it, and a smooth stop on Jamie's comment.
- **Sticky social bar:** when the counts row reaches the top it pins there with the action bar (91 px), white with a hairline under it, so the counter stays visible all film. This is the one liberty taken with LinkedIn's layout.
- **Speed limit:** no content point in view moves more than 13 px a frame (the wave speed is 12.67). No motion blur: this is a screen recording.
- **Avatars:** 36% the default silhouette (warm grey ground, blue-grey figure), including Mom, the robot, Doug and the viewer. The rest are close crops of the project's own footage with no face and no mark: hands on keys, a guitar body, a desk lamp, a mug, clapping hands, a corridor. Crops come only from Office and Instrument shots with `faceBox` null, never Pat, and none repeats within 12 rows. Jamie's is a warm, sunlit crop of mugs by a coffee maker, an echo of the bakery. Frames: Open to Work green (Shayla, Tanya) and #Hiring purple (Kyle, Yuki, Carly, Ana Lucía, Lindsey, Whitney), drawn as a crescent at 7:30 tapering to nothing at 12 and 3.

## The timeline

100 BPM: a beat is 0.6 s (18 frames), an 8th 9 frames, a bar 2.4 s. B is the beat from 0; frame = 18 x B. "On the line" means the row's top edge is on the reading line.

| B | t (s) | Frame | Picture | Sound |
|---|---|---|---|---|
| 0 | 0.0 | 0 | The thumbnail: post clamped to 3 lines with "…more", 47 reactions, "12 comments" (reposts hidden at 0). The composer, the suggested replies and Dana's comment below. | Rhodes alone, Bm9 |
| 2 | 1.2 | 36 | "…more" opens; the text reflows to full length, no animation. | |
| 4 to 7.5 | 2.4 to 4.5 | 72 to 135 | The reaction burst on 8ths: 47 to 64. | 8 soft ticks |
| 8 | 4.8 | 144 | The roll eases in (two beats). The counts row sticks at frame 184 (B10.2). | Bass, soft kick |
| 10 to 19 | 6.0 to 11.4 | | The warm block, rows 1 to 11, at a steady 289 px/s (Inter). The counter is still. | Chorus guitar |
| 20 | 12.0 | 360 | "Load more comments" settles on the line (a full stop). | |
| 21 | 12.6 | 378 | Pressed: #EBEBEB for 4 frames, then a 20 px spinner. | Everything stops but the Rhodes |
| 22 | 13.2 | 396 | Rows 12 to 14 appear where the button was, row 12 on the line. The comment counter starts, on 8ths. | Voice 1: S1, alone, dry |
| 23, 24 | | 414, 432 | Rows 13 and 14, one a beat. | Four on the floor from B24 |
| 26 | 15.6 | 468 | **"Congrats, Jordan!"** (row 15) dwells 3 beats. 41 comments. | |
| 29 to 32 | | | Wave 2, rows 16 to 19, one a beat. | S2, then Synthia's Y1 |
| 34 | 20.4 | 612 | **The recruiter** (row 20, #Hiring frame) dwells 3 beats. "96 comments • 1 repost". | Claps on 2 and 4 |
| 37 to 39.5 | | | Wave 3, rows 21 to 26, on 8ths (380 px/s). | x3 |
| 40 | 24.0 | 720 | The cluster flips to Celebrate, Like, Love. | |
| 41 | 24.6 | 738 | **"So well deserved!"** (row 27) dwells 2 beats. | Pad |
| 43 to 46.5 | | | Wave 4, rows 28 to 35. | x4 |
| 48 | 28.8 | 864 | **"Let's connect!"** (row 36, Open to Work frame) dwells 2 beats. The counter lands on **340**. | Accent tick |
| 50 to 53.5 | | | Wave 5, rows 37 to 44. | x6 |
| 55 | 33.0 | 990 | **The vendor pitch** (row 45, five lines in Inter) dwells; its launch starts a 16th early so the roll stays under the speed limit. | |
| 57 to 68.5 | 34.2 to 41.1 | | Waves 6 to 8, rows 46 to 69 on 8ths. From about B59 to B62 every row in frame is the same sentence: the pattern at 1x. 👏👏👏 (row 56) passes at B62, "Insightful" (row 63) at B65.5, no dwell. | x8, canon |
| 70 | 42.0 | 1260 | **The robot** ("LinkedIn Member", row 70): "Congrats on 5 years at Brightwick!" dwells 3 beats. 911 comments. | Choir choked |
| 71 to 76 | 42.6 to 45.6 | 1278 to 1368 | The pull-back, k 1 to 0.45 (sine in-out), starting under the robot's dwell so it shrinks into the top of the column. | |
| 74 to 81.5 | 44.4 to 48.9 | 1332 to 1467 | **The wall:** rows 71 to 86 arrive on 16 consecutive 8ths. Held at 0.45 from B76 to B82: a white column of about 12 identical rows on feed grey. The counter jumps on 16ths. | 16-entry canon, the peak |
| 82 | 49.2 | 1476 | The push back in (k 0.45 to 1 by B85.5). "Congratualtions!!" (row 87, "41m (edited)") is on the line, the wall's last 8th. Then wave 10 slows: rows 88 to 92 at B82.5, 83.0, 83.6, 84.3, 85.1. | The choir thins |
| 88 | 52.8 | 1584 | **Jamie's comment** (row 93, Author pill) stops on the line: "Thank you all! 🙏 First day tomorrow." 1,203. The roll stops. | Gmaj9, left to ring |
| 92 | 55.2 | 1656 | Doug's reply appears under Jamie's: "Congrats on the new role!" **1,204.** Jamie's comment reads "Reply · 1 reply". | One tick, then S1 again, dry |
| 98 | 58.8 | 1764 | End. The last frame (1763) has been held since B92. | Silence after the voice |

The counter's landmarks (comments, reactions, reposts): 12/47/0 at B0, 64 reactions after the burst, 41/118/0 at B26, 96/260/1 at B34, 187/488/2 at B41, **340**/1,126/4 at B48, 512/1,690/6 at B55, 688/2,214/8 at B62, 803/2,560/10 at B65.5, 911/2,931/12 at B70, 1,140/3,604/16 at B83, 1,203/3,851/18 at B88, **1,204**/3,862/18 at B92. Between them the numbers jump once per 8th (once per 16th through the wall), unevenly, seeded, never by zero, and every change on screen has a tick (`timeline.js` `ticks()`, 158 of them).

## The comment script

`src/films/day-one/script.json` (from the copy study, the company templated). The rows that are not uniform wave rows:

| Row | Who | Headline | Time | Comment | On the line |
|---|---|---|---|---|---|
| 1 | Dana Whitfield (She/Her) • 2nd | Owner at Second Rise Bakery / Bread, coffee and good people | 1d | We'll miss you on the 6am bake. Brightwick has no idea how lucky they are. Proud of you, kid. | warm block |
| 2 | Jamie Okafor (She/Her), reply, Author pill | Associate Coordinator, Revenue Enablement at Brightwick / Merrow State '26 | 1d | Dana!! I'll still come in for the morning buns ❤️ | warm block |
| 3 | Priya Raman • 3rd+ | Marketing Coordinator at Fernway / Merrow State '26 | 1d | @Jamie Okafor YES!!! 🎉 Told you. The group chat is screaming. | warm block |
| 4 | Rose Okafor • 3rd+ | Retired School Nurse | 1d | So proud of you sweetheart!!! ❤️❤️ Love, Mom | warm block |
| 5 | Jamie Okafor (She/Her), reply, Author pill | Associate Coordinator, Revenue Enablement at Brightwick / Merrow State '26 | 1d | Mom 😭 | warm block |
| 6 | Ruth Calloway, PhD • 3rd+ | Associate Professor of Communication at Merrow State University | 1d | From COMM 214 to Revenue Enablement. I knew you would land somewhere wonderful. | warm block |
| 7 | Marcus Lindqvist (He/Him) • 2nd | Senior Manager, Revenue Enablement at Brightwick | 1d | Welcome to the team, Jamie! So glad you said yes. See you soon ☕ | warm block |
| 8 | Aisha Bello (She/Her) • 3rd+ | Merrow State '26 / Aspiring UX Researcher | 1d | the way I SCREAMED. so proud of you 🥹 | warm block |
| 9 | Tess Moreno • 3rd+ | Shift Lead at Second Rise Bakery | 1d | who is going to fix the espresso machine now 😭😭 congrats Jamie!! | warm block |
| 10 | Owen Gallagher • 2nd | Sales Development Representative at Haverly Group / Merrow State '24 | 23h | Huge! They're getting a good one. Remember us when you're VP 😄 | warm block |
| 11 | Nadia Ferrante • 2nd | People Partner at Brightwick | 23h | Welcome aboard! 🎉 Your laptop is ready. | warm block |
| 15 | Gregory Pham • 1st | Regional Sales Manager at Copperline | 22h | Congrats, Jordan! | B26 |
| 20 | Kyle Henshaw (He/Him) • 3rd+, #Hiring frame | Senior Talent Partner at Kestrel Ridge Talent / Placing GTM Leaders in SaaS / #Hiring | 19h | Love this! Open to a quick chat about a Senior role? | B34 |
| 27 | Devon Marchetti • 3rd+ | Keynote Speaker / Bestselling Author / Helping Founders Build Personal Brands That Convert | 16h | So well deserved! | B41 |
| 36 | Shayla Kim (She/Her) • 3rd+, Open to Work frame | Open to Work / Marketing & Communications / Merrow State '25 | 12h | Let's connect! | B48 |
| 45 | Brett Lorimer • 3rd+ | Account Executive at Ramplight / Helping Revenue Teams Ramp Reps 3x Faster | 9h | Congrats Jamie! As you get started in Revenue Enablement, Ramplight helps teams cut rep onboarding time by 41%. Worth a 15-minute chat next week? 🚀 | B55 |
| 56 | Gail Ostrander • 3rd+ | Proud Merrow State Alum | 6h | 👏👏👏 | B62 |
| 63 | Neil Varma-Hollis • 3rd+ | Futurist / AI Evangelist / Web3 / Keynote Speaker | 4h | Insightful | B65.5 |
| 70 | LinkedIn Member | (none) | 2h | Congrats on 5 years at Brightwick! | B70 |
| 87 | Terri Lynn Baxter • 3rd+ | Retired Realtor / Proud Grandma of 6 | 41m (edited) | Congratualtions!! | B82 |
| 93 | Jamie Okafor (She/Her), Author pill | Associate Coordinator, Revenue Enablement at Brightwick / Merrow State '26 | 6m | Thank you all! 🙏 First day tomorrow. | B88 |
| 94 | Doug Halvorsen • 3rd+, reply | Regional Account Manager | 1m | Congrats on the new role! | appears B92 |

- **Wave 1** (3): Rachel Imbert 23h, Sunil Varghese 22h, Megan Kostas 22h.
- **Wave 2** (4): Derek Fenwick 21h, Alana Brooks-Ito 21h, Emeka Nwosu 20h, Lauren Pike 20h.
- **Wave 3** (6): Haruto Saito 19h, Bianca Ferreira 18h, Caleb Strand 17h, Ines Duarte 18h, Mitchell Osei 17h, Kristen Vale 16h.
- **Wave 4** (8): Rohan Mehta-Rao 15h, Sofia Lindgren 15h, Danielle Yoon 14h, Rob Castellanos 14h, Fatima Haddad 13h, Greg Ostrowski 13h, Yuki Tanabe (#Hiring) 12h, Nicole Brandvold 12h.
- **Wave 5** (8): Andre Whitaker 11h, Leah Goldfarb 11h, Samuel Adeyemi 10h, Courtney Rask 10h, Vikram Iyer 10h, Erin McAllister 9h, Diego Paredes 9h, Hannah Sobczak 9h.
- **Wave 6** (10): Wade Tolliver 8h, Kayla Dimitrov 8h, Ben Achterberg 8h, Rosa Quintero 7h, Trevor Lindahl 7h, Mei-Ling Cho 7h, Jason Pruitt 7h, Olivia Haskins 6h, Rahul Bhandari 6h, Stephanie Kerr 6h.
- **Wave 7** (6): Luis Bautista 5h, Amanda Feld 5h, Kwabena Asare 5h, Carly Westover (#Hiring) 4h, Nathan Rhee 4h, Grace Obi 4h.
- **Wave 8** (6): Tyler Hammond 3h, Zara Siddiqui 3h, Brian Kessler 3h, Ana Lucía Ríos (#Hiring) 3h, Scott Dumont 2h, Jessica Tran 2h.
- **Wave 9, the wall** (16): Ibrahim Kaya 2h, Molly Brennan 2h, Eli Navarro 1h, Renee Castillo 1h, Adam Wójcik 1h, Tanya Morales (Open to Work) 1h, Hiro Matsuda 1h, Brooke Delaney 1h, Omar Haidari 1h, Lindsey Graff (#Hiring) 1h, Chris Mbatha 58m, Paige Holloway 55m, Sanjay Kulkarni 49m, Kelsey Ward 52m, Felipe Aranda 44m, Monica Strauss 47m.
- **Wave 10, slowing** (5): Dmitri Arkhipov 33m, Whitney Cole (#Hiring) 27m, Tariq Benali 14m, Jenna Hartley 21m, Lamar Greene 9m.
Wave rows are uniform: a one-line headline, "Congrats on the new role!", "Like | Reply", no pronouns, no counts, pitch exactly 114 px. About one time in four trades with its neighbour inside a wave (the "Most relevant" tell).

## The one command (on the Mac)

```
cd linkedin
npm install                        # once; then, once: npx playwright install chromium
node scripts/render-day-one.mjs --out out/day-one --stills
node scripts/check-day-one.mjs --dir out/day-one
```

The render starts its own Vite server, opens Chromium at 360x640 @3, waits for the page (fonts measured, avatars decoded), logs the font each kind of text resolves to (it should read SF Pro, "SF NS" or "System Font"; here it reads Inter), renders the score offline (`score.js`, 48 kHz stereo), captures 1,764 frames into ffmpeg and muxes. It writes `day-one.mp4` (H.264 High, CRF 14, yuv420p, BT.709, 30 fps CFR, AAC 320k 48 kHz, faststart), `day-one.wav`, `timeline.json`, `contact-sheet.png` and, with `--stills`, the key beats at full size. About 3.5 minutes here (96 ms a frame, plus about 23 s for the score); `--preview` renders 540x960 in about 2.

Options: `--company Name` (default Brightwick), `--from s --to s` (a span), `--preview`, `--channel chrome` (the installed Google Chrome), `--audio FILE` (mux a finished mix instead of rendering the score), `--silent`, `--frames 0,396,1656` (stills only, for review), `--remux` (keep the rendered picture in `--out`, render the score again or take `--audio FILE`, and mux it: for when only the sound has changed).

## Review checklist

Run `node scripts/check-day-one.mjs --dir out/day-one` (add `--compare out/day-one-2` after a second render for run-to-run determinism). It checks, and a person then looks:

1. **Format:** 1080x1920, 30/1 CFR, 1,764 frames, H.264 High yuv420p BT.709, AAC 320k 48 kHz, faststart, audio and video within a frame.
2. **Determinism:** a frame seeked on its own in a fresh page matches the frame rendered in sequence, byte for byte; two runs give identical PNG hashes and identical WAVs.
3. **Sync:** 340 first shows at frame 864 and 1,204 at 1656; every counter change has a tick within a frame; the 16 wall rows arrive within a frame of their 8ths; every wave and special row arrives within a frame of its beat; "grats" within a frame of 396 and 1656 (from the score's marks).
4. **UI lint at 12 sample times:** weights 400/600, sizes 12/14, every colour a token, no green type, "…more" with U+2026, counts lowercase, comma-formatted, pluralised ("1 repost"), degrees " • 1st/2nd/3rd+", no time older than "1d", "LinkedIn" only in the robot's name, no path from LinkedIn's reaction SVGs shipped, no initials avatars.
5. **Pattern:** uniform rows pitch exactly 114 px; row 12 replaces "Load more comments" at the same y.
6. **Legibility:** each special row is on screen, at or above the reading line, for its whole dwell. At phone size (390 px wide) the six jokes read: Jordan, the recruiter, "So well deserved!", "Let's connect!", the vendor, the robot. Look at `stills/` and the contact sheet.
7. **Camera:** no content point in view moves more than 13 px a frame.
8. **Canon:** flashes at most 3 a second, whole frame and quadrants (`src/pegboard/governor.js`); no faces, no Pat (every crop from a face-free shot); green only as a frame or the Celebrate disc, never type; no Zoom or Lite-Brite marks.
9. **Audio:** -10 +/-0.5 LUFS, true peak <= -1 dBTP, digital silence B91 to B92 and on the tail. The null test of the final S1 against Voice 1 and the Whisper test are the sound's checks (`scripts/measure-day-one-sound.py`).
10. **On the Mac:** the font log reads SF Pro, and checks 1 to 9 pass on that render too.

By eye: the first frame reads as a real post you would scroll past; nothing jumps when the bar sticks or when the rows replace the button; the wall reads as a pattern before it reads as text; the robot sits at the top of the column when the pull-back lands; the last frame holds Jamie's thanks and Doug's reply, and nothing else moves.

## What differs from the build spec

- **Company:** Brightwick everywhere (Aaron's decision), switchable with `--company`.
- **Pull-back:** B71 to B76 with a sine ease, not B73 to B76 cubic: the cubic moved the bottom of the frame 23 px a frame at B74.5, where the zoom and the wall's speed add up. The push back in runs B82 to B85.5 (sine) for the same reason. The wall still holds at 0.45 from B76 to B82.
- **Row 87 ("Congratualtions!!")** lands on the line at B82, the wall's last 8th, not B83: with the wall at 380 px/s through B81.5 and a smooth stop on Jamie at B88, the rows between fall where a slowing flick puts them (88 to 92 at B82.5, 83.0, 83.6, 84.3, 85.1). It is read during the push-in.
- **The vendor's launch** starts a 16th early (five lines in Inter, not four) to keep the launch under the speed limit.
- **Warm block pace:** 289 px/s, not about 230: the warm comments are taller than the estimate (two and three lines in Inter). SF Pro is a little narrower and will be a little slower.
- **Jamie's headline** shows on her own comments (LinkedIn shows the author's headline beside the Author pill); the script had it blank.
- **The comment time** sits 40 px from the bubble's right edge, not 48, so "Terri Lynn Baxter • 3rd+" fits beside "41m (edited)".
- **"…more"** is built at a word boundary (the words that fit three lines, then "…more" in 600 secondary with 8 px before it) rather than laid over a cut word.
- **Suggested replies:** the second chip, not the third, is cut by the right edge ("Congrats on the new role!" is wide).
- **Celebrate disc:** green (#5FA046) as a reaction icon, never as type.
- **Below the thread** the page stays white (the app's post view), so "Load more comments" does not sit over a grey void.
- **Renames:** Rose Okafor (Mom) and Rohan Mehta-Rao, as the spec proposed, to avoid the band's Linda and Arjun.
- **The robot:** "LinkedIn Member", no headline, no degree, silhouette.

## For Aaron

- The robot as "LinkedIn Member", or an ordinary name with an empty headline.
- Pull-back depth 0.45 (legible, about 12 rows) or 0.33 (texture only).
- The sticky social bar, the one structural liberty.
- The suggested-reply chips (they plant the flood; the real wording is unconfirmed).
- The avatars: object crops read as "people who use a photo of their desk". If that reads too odd at phone size, the alternative is more silhouettes.
