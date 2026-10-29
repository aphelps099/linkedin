# LinkedIn Beats project bible

Updated October 29, 2026. Project owner and creative approval: Aaron Phelps. This is the starting point for the whole LinkedIn Beats project: its cast, music, films, visual language, useful tools and eventual personalized meeting videos.

LinkedIn Beats is an office ensemble whose professional ambitions are considerably larger than its deliverables. The music deserves to be listened to. The artwork deserves to be looked at. The people take every meeting seriously. The audience discovers the absurdity without anyone pointing it out.

The existing films and tools establish the world. New character motivations, episode arcs, animated human designs and generator interfaces below are development proposals, not previously approved canon or shipped features.

## Project map

| Workstream | Existing foundation | Next deliverable |
| --- | --- | --- |
| Beats and synth | CB–08 sampler, sequencer, character voice library and original film beds | A small musical vocabulary for each character; separate reusable stems and arrangements |
| Characters | Seven human voice identities, Synergy, Synthia, printer, floor droid and Pat | Human animation model sheets matched to the Learn Synergy world |
| Office drama | Seven agendas with two authored meetings each; printer and paper-droid films | Recurring relationships and a short connected season |
| Thumbnail art | Approved compact carousel, rounded art, white caption bodies, real cast references | A maintained library of compositions tied to episodes and characters |
| Roast and certificates | Roast experience plus Learn completion and certificate system | A distinct, shareable Roast certificate concept alongside existing Learn certificates |
| Personalized meetings | Authored meeting playback, cast media, timed voice bank and audio engine | One topic-to-video prototype using an approved cast and reusable scene templates |
| Operations | Cutting Room catalog, media provenance, Render deployment, GA4 | Consistent approval records, release checks, generation cost tracking and useful measurement |

## Read in this order

1. [Characters and animation](characters.md): identities, office roles, instruments, voices, relationships and model-sheet requirements.
2. [Creative direction](creative-direction.md): humor, music, thumbnail art, dramatic structure and certificate concepts.
3. [Meeting creator](meeting-creator.md): intended experience, proposed API contract and production pipeline.
4. [Delivery plan](delivery-plan.md): ordered milestones, review criteria and decisions still to make.
5. [Asset registry](asset-registry.json): stable cast IDs and local reference paths. This is a documentation index, not a replacement for the runtime catalogs.

## The shared creative contract

Treat modest office events with absolute sincerity. A folder rename may have political consequences. A printer can receive a career retrospective. Someone still needs access. Nobody performs a joke for the camera.

Give characters practical desires and obstacles. A list of fashionable words is raw material; a scene needs a reason someone says them. Keep dialogue specific enough that removing a character would change the scene.

Keep the site colorful, dimensional and inventive. Dry humor governs performance and writing; it does not require flat, austere art. Use TT Hoves, rounded artwork, consistent frames and very little text. The art is part of the project’s identity, with its own development and review time.

Every character has one identity across filmed scenes, animated appearances, thumbnails, voice samples and certificates. Their render style can change; their face, role, clothing cues, voice and behavior should remain recognizable.

## Existing sources of truth

- Current cast and instruments: `src/meeting-room/catalog.js`.
- Voice identities: `src/meeting-room/voice-bank/characters.js`.
- Authored dialogue: `src/meeting-room/scripts.js`.
- Current meeting timing and media: `src/meeting-room/audio-manifest.json`, `media-manifest.json`, and `PERFORMANCE-PRODUCTION.md`.
- Synth: `src/synth/README.md` and its sound catalog.
- Learn: `docs/program/README.md`, `src/program/components/certificate-art.js`.
- Roast: `src/roast/Roast.jsx` and `roastEngine.js`.
- Approved thumbnail direction: [Thumbnail art notes](../thumbnail-art-notes.md).
- Film continuity: [Optimizing](../optimizing-film-direction.md) and [Moving Things Forward](../paper-droid-moving-things-forward.md).
- Source library: `src/cutting-room/README.md`. Cutting Room is unlisted, not private or password protected.

The older `src/meeting-studio/README.md` describes another implementation. Use `src/meeting-room/` for current meeting canon. The floor droid’s solo film supersedes the mistaken Synergy interpretation in `docs/synergy-the-report-is-attached.md`. The floor droid remains silent in the existing meeting engine; its solo film has its own robotic vocal and beep performance.

## Analytics decision

GA4 is installed with opt-in and a slim consent bar. Google requires disclosure of Analytics and its data processing in the privacy policy; it does not prescribe that particular popup. Consent requirements depend on applicable law and configuration. The current worldwide opt-in is an implementation choice, not a finding that every visitor everywhere legally needs a banner.

If an uninterrupted experience is the priority, evaluate an aggregate-only measurement design against applicable exemption conditions before changing collection. A cookie-free label alone does not establish an exemption. Regional consent is another possible approach, with reliable region detection and a defined fallback. No analytics behavior changes are included in this project-bible revision.

Sources checked October 29, 2026: [Google Analytics terms, section 7](https://marketingplatform.google.com/about/analytics/terms/us/) and [ICO statistical-purpose exceptions](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/).
