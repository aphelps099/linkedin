# Studio 2 — stage preview

`/studio-2/` is an independent, noindex preview of the existing live stage.
It mounts the same CircleBack engine with `stagePreview`, initially in stage mode.
The original `/studio/` keeps its mixing-desk default and original stage appearance.

The ASCII renderer, backdrop scale, grain and audio response are unchanged.
Preview-only changes: approved wordmark, TT Hoves / GT Mono, quiet broadcast chrome,
responsive square monitor, direct performance controls, compact menu and Mix access.
The phrase reveal, synthesized audio, voice locking, remix and desk continue to use existing functionality. Export actions have been removed from the stage, desk and advanced view. The shared audio-tools dialog now offers Voice environment tiles, three Sound character presets, a large Tempo slider with step buttons, and a voice audition button.

Validation: production build, existing studio engine/MIDI checks, DOM interaction
checks for stage default, build/drop, drawer and desk navigation, legacy default.
Browser visual and audible playback QA were unavailable in the editing environment.
