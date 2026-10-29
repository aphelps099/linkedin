# Personalized meeting creator

## Intended experience

A user chooses a meeting topic, cast, duration and musical mood, adds a few details, and receives a short meeting film performed by the LinkedIn Beats ensemble. JibJab is the reference for easy personalization and a recognizable recurring cast. The creative target is a sincerely performed office scene.

The first release should use approved animated characters and reusable layouts. It does not need arbitrary face uploads or a newly generated video for every frame. New shot generation can supplement the library once the core experience is reliable.

Proposed flow: choose a topic → add details → select cast and mood → preview the script → render → watch, revise or share. The six default topic areas are onboarding, Google Drive sharing, website updates, social-media post impressions, professional-development time and conference follow-up. Keep the technical provider choices out of this flow.

The recurring “I used ChatGPT to…” announcement can be applied to any of those topics, following `creative-direction.md`. Ground it in a specific assisted task and an outcome the character actually checked or completed. This is a writing format, not a claim that the meeting creator already integrates with ChatGPT or performs external office tasks.

## First prototype

Make one 30–40 second “Access pending” meeting with Synergy, Kevin and People & Culture. Accept a company alias, an onboarding resource or Google Drive folder name, and a requested outcome. Anchor the scene in actually helping a colleague access needed materials. Use one four-tile meeting layout, a reusable original bed, fixed character voices, timed captions and a rendered MP4. Make changes in the script preview inexpensive; do not start a paid video render merely because someone edits a field.

The script should have six to nine short turns and one restrained closing line. User fields influence the obstacle and responses, not just a title card. The characters must retain their own motivations and diction. Start with a deliberately bounded template grammar; extend generation after this example works well.

## Proposed production pipeline

1. Validate topic, cast IDs, input length and duration. Treat entered text as scene material, not instructions to change system behavior.
2. Build a structured scene: a credible achievement from the six topic areas, objective, turns, speaker IDs, pauses, emphasis, musical cues and closing line. Apply the standing achievement rule in `creative-direction.md`: exaggerate corporate framing, preserve factual outcomes and metrics, and keep the performance sincere. Validate it against the selected cast and time budget.
3. Generate or retrieve voice takes using the fixed character voice profiles. Derive timing from actual audio, not guessed word counts.
4. Assemble licensed/original stems and beeps with dialogue space. Use the same timing for playback, animation, captions and export.
5. Animate approved rigs or reusable performance states. Keep humans recognizable and instrument motion credible. Use actual phoneme timing when available; label approximate mouth animation honestly during development.
6. Render video in a background worker. Persist job state and result metadata, handle provider callbacks, retries, cancellation and failure. Keep the web service available while rendering runs.
7. Check duration, decode, audio peaks, caption bounds, missing assets and a representative frame sequence. Human review remains necessary for new character/shot material.
8. Save the final MP4, poster, captions and composition manifest. Return a stable page URL whose metadata describes that exact meeting. Preserve reproducible source versions.

The current repo provides cast IDs, media manifests, a voice bank, scheduling and share patterns. This pipeline and the API below are proposed work; a public personalized render service is not implemented by this document.

## Proposed API contract

`POST /api/meeting-jobs` accepts `topicId`, `castIds`, `details`, `durationSeconds`, `musicPresetId`, `visualStyleVersion` and an idempotency key. It returns a job ID and status URL. A validated script-preview stage precedes paid rendering.

`GET /api/meeting-jobs/:id` returns a state such as `queued`, `writing`, `voicing`, `rendering`, `checking`, `ready`, `failed` or `canceled`, with the script preview or result when available. Expose a progress percentage only when the underlying work can support one.

`POST /api/meeting-jobs/:id/cancel` cancels remaining work where supported. A retry must not accidentally bill twice or create a second finished artifact for one idempotency key. Use a private access token or authenticated ownership check for job status and draft assets.

The immutable composition manifest contains the script, character and voice versions, asset hashes, music version, exact cue offsets, render settings, provider task IDs and cost records. Store provider credentials server-side. Use a provider adapter rather than coupling the user interface to one model; benchmark identity, intelligibility, time and cost before selecting the public-render provider.

## Release limits and acceptance

Define generation limits before public launch: allowed duration, concurrent jobs, per-user quota, retry ceiling, cancellation rules and spend cap. Estimate cost per completed video from real tests, including failed generations. Do not promise instant rendering or a fixed cost before measurement.

A usable first render must preserve the three identities; keep every line audible; show the correct active speaker; remain synchronized after seeking; download successfully; and open the exact result from a shared link. Test an unusually long company name and a failed provider call as well as the happy path.

Use the approved fictional cast for the first version. Any later real-person uploads require a separately designed likeness/voice permission flow. Creation does not publish a result automatically; the user previews it and chooses to share.
