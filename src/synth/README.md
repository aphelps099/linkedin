# Corporate Sampler · /synth/

Standalone React entry built through the existing Vite multi-page configuration. No new dependencies or server endpoints. Uses Web Audio and original procedural drum/tonal samples plus existing voice recordings in `/phrases/05.wav` and `/phrases/06.wav`.

Eight pads, 16-step live sequencer, three starter patterns, pad mute, sample selection/upload/drop, start/end trim, pitch, reverse, gain, master low-pass/delay, keyboard 1–8 and Space. Stop cancels queued notes and disconnects delay feedback. Background tabs pause deliberately. Audio begins only on interaction.

Projects autosave to IndexedDB in the current browser. Download/open JSON includes custom sample data; import validates all fields and only accepts embedded audio or known factory sound identifiers. Maximum uploaded file: 8 MB / 30 seconds decoded. Samples never upload to a server. Export renders four repetitions of the one-bar pattern into stereo PCM WAV with a tail for long/pitched samples and echo, using the same audio graph as playback.

`node scripts/check-synth.mjs` checks project validation, rhythm timing, presets and WAV encoding. `npm run build` includes `dist/synth/index.html`; existing Express static routing serves `/synth/` and redirects `/synth` to it. Mobile keeps the instrument within the viewport and scrolls only the sequencer grid.

This is an original sampler, not M-VAVE firmware or an FM-1 emulator. No firmware flashing, hardware MIDI, microphone recording or cloud project account is included.
