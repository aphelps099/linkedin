# Circle Back® product roadmap

Form CB-RM · Rev. 2026-08 · Plans subject to mandatory alignment

The product loop is:

**Inspect the genre → improve the writing → perform the evidence → preserve the artifact.**

The satire earns attention. The useful writing feedback earns repeat use. Every
tool should end in a shareable object and a clear door into another tool.

## Now

### Dynamic Voice v2: every post becomes a real performance

Today, OpenAI generates the post-specific compliance interruption while the
first three lines use the fixed archive. The next milestone should let the
remix say every useful name, product, acronym, number, and punchline in the
user's post.

#### Experience

- Generate a compact four-line performance from the post:
  **setup → corporate escalation → incriminating phrase → compliance punchline**.
- Begin the show as soon as the first clip is ready. Generate the remaining
  clips in parallel and file them into the arrangement progressively.
- Keep Play simple. No model picker, provider picker, or prompt controls in the
  main interface.
- Preserve the polished human announcer plus the 1980s mainframe robot as the
  default duet. The robot should interrupt, not narrate the entire track.
- Let the user regenerate the voice once from Audio Tools if the read lands
  badly.
- Cache generated clips for the current remix so Play and Export use the exact
  same performance.
- Keep the archive fallback. If generation fails, the words on screen must
  still match the words the app can actually say.

#### Technical direction

- Keep `gpt-4o-mini-tts` as the first production candidate. The existing server
  contractor, credentials, and instruction controls already work.
- Change the API from one batch response that blocks on every line to
  independently retrievable clips or a progressive response.
- Prefer WAV or PCM during generation for faster decoding and reliable WebAudio
  scheduling. Compress only when needed for storage or transport.
- Pre-generate the first clip, schedule it on the next musical boundary, then
  fill the next three slots before their bars arrive.
- Add timeout, retry, cancellation, rate-limit, and per-remix usage guards.
- Never expose provider credentials in browser code.

#### Provider decision

Do not switch providers on reputation alone. Run the same Circle Back script
set through:

1. **OpenAI** — incumbent; steerable delivery, streaming speech, preset voices,
   and a path to a consent-based custom Circle Back voice.
2. **Cartesia Sonic** — challenger; evaluate its low-latency streaming and
   emotive control on names, acronyms, clipped timing, and robot treatment.
3. **ElevenLabs** — optional benchmark only if the first two fail the voice
   quality bar.

Score each blind sample on:

- time to first playable audio;
- pronunciation of names, acronyms, and “ChatGPT”;
- ability to stay polished without sounding like an advertisement;
- ability to take post-processing without becoming muddy;
- rhythmic consistency across repeated generations;
- total failure and retry rate;
- cost per completed four-line remix.

**Decision rule:** stay with OpenAI unless another provider produces a clearly
better Circle Back performance, not merely a more realistic generic voice.

Official references:

- OpenAI text-to-speech and streaming:
  https://developers.openai.com/api/docs/guides/text-to-speech
- Cartesia Sonic:
  https://www.cartesia.ai/sonic

#### Definition of done

- A pasted post containing an unseen proper noun can produce four matching
  spoken lines.
- The first line becomes playable without waiting for the full set.
- Play and exported video contain the same voice takes.
- A failed voice request returns to a truthful, audible archive performance.
- Desktop and mobile users never see provider configuration.

### Export and viral loop reliability

- Validate H.264 + AAC output on Chrome, Edge, Safari, iOS, and Android.
- Never label a VP9/Opus fallback as a universally compatible MP4.
- Add a final share screen with the video, a still frame, Copy caption, Download,
  and Remix another post.
- Keep the artifact square, legible without sound, and understandable within
  the first two seconds.
- Add an unobtrusive Circle Back identifier and URL to exported artifacts.

## Next

### Museum gallery prototype

Status: **Room 01 prototype implemented.**

Build the Museum as curated 2.5D rooms, not a free-roaming 3D world. It should
feel spatial and memorable while remaining fast, readable, keyboard-accessible,
and shareable.

#### Room model

- **Lobby:** explains the institution and gives three obvious doors.
- **Hall of Humble Brags:** the canonical permanent collection.
- **Delve Wing:** AI tells, tapestry language, and machine-polished prose.
- **Engagement Bait Annex:** polls, “agree?”, and manufactured vulnerability.
- **Redaction Office:** anonymize a submission locally and preview its placard.
- **Special Exhibition:** a rotating weekly theme or leaderboard.

#### Implemented foundation

- Room metadata lives in `src/museum/rooms.js`; exhibits are assigned by ID
  instead of embedded in layout code.
- `GalleryRoom` owns room navigation, responsive presentation, and exhibit
  inspection. Desktop gets a curated 2.5D wall sequence; mobile and reduced
  motion default to the same collection as a readable list.
- The exhibit inspector is the share-and-handoff object: full artifact,
  curator note, index, and direct doors to Roast or the mixer.
- The Redaction Office remains below the first room. The Historical Archive is
  now a separate dark timeline entered through the footer copyright, with a
  stable `#archive` URL, scroll reveals, keyboard dismissal, and reduced-motion
  support.

#### Next Museum increment

- Add a compact lobby that makes the room model legible without becoming a
  product dashboard.
- Add the Delve Wing using the same room schema and `GalleryRoom` component.
- Give each exhibit a stable URL so a specific artifact can be shared and
  reopened directly.
- Add an exhibit-specific screenshot/export treatment before introducing any
  free-roaming navigation.

#### Interaction

- Move room-to-room with horizontal parallax and deliberate camera transitions.
- Select a framed post to bring it forward as a readable exhibit card.
- Every exhibit offers **Inspect**, **Roast**, and **Turn into a beat**.
- Generate a screenshot-shaped placard for sharing.
- Offer a simple list view for mobile, reduced motion, accessibility, and search.
- No joystick, collision physics, empty corridors, or decorative 3D wandering.

#### Prototype gate

Prototype one room with six exhibits before expanding the collection. Continue
only if users understand where to click, read at least two exhibits, and use a
handoff action without instruction.

### Unified product shell

- Give all four tools a small, consistent institutional navigation system.
- Preserve each tool's distinct theatrical world instead of forcing one giant
  application interface over everything.
- Standardize handoff payloads between Lessons, Roast, Museum, and the mixer.
- Create shared modules for score, detector output, privacy language, export,
  and handoff state.
- Keep each tool independently linkable and fast to load.

### Serious grader destination

- Create a direct “check before you post” path around the Thought Leadership
  Index.
- Show evidence before score: inline marks, one-line reasons, then verdict.
- End with a clean rewrite and explain which patterns changed.
- Add calibration examples and a way to dispute false positives.
- Keep pattern detection local until a learned model clearly improves quality
  without weakening the privacy promise.

## Later

### Browser extension

- Run the index in the LinkedIn composer.
- Show marks on demand, not as constant nagging.
- Offer one-click humanization and a route to the full roast or remix.

### Teams and brand voice

- Shared banned and preferred language.
- House-style rules such as “we do not say leverage.”
- Team-level index trends and pre-publish gates.

### Weekly index

- Publish an editorial leaderboard of professional-internet language.
- Acquire Museum exhibits through transparent, privacy-safe curation.
- Use the index as recurring content, not an automated harassment engine.

### LinkedIn publishing

- Investigate a Clerk-backed LinkedIn connection only after export and remix
  retention are proven.
- Treat direct publishing as optional convenience, never a dependency.
- Require an explicit preview and user action before anything is posted.

## Explicit non-goals

- A general-purpose music workstation.
- A public model/provider settings panel.
- Free-roaming 3D museum navigation.
- Automatic publication without a final user action.
- Sending the full pasted post to a voice provider when four short performance
  lines are sufficient.
- Replacing the satire with a conventional writing-assistant dashboard.

## Recommended order

1. Full four-line Dynamic Voice v2 on the current OpenAI contractor.
2. Blind OpenAI versus Cartesia voice bake-off.
3. Export compatibility and share screen.
4. One-room Museum prototype. **Implemented.**
5. Unified shell and handoff contract.
6. Serious grader destination.
7. Extension, teams, weekly index, and direct publishing.
