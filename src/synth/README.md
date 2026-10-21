# Corporate Sampler · /synth/

Standalone React entry built through the existing Vite multi-page configuration. No new dependencies or server endpoints. Uses Web Audio, original procedural drum/tonal samples and the existing character recordings and guitar.

The searchable sound library contains 172 character clips (all nine speaking characters), three guitar fills and their combined take, plus the original eight sounds. Preview is separate from the project; loading a sound replaces only the selected pad, resets trim/pitch/reverse and preserves its pattern. Opening the library stops the sequencer. Audio loads on demand. Robot solo cues are sliced from existing season recordings; mixed chorus-only lines are omitted because those voices cannot be isolated. Silent characters have no vocal samples. No voices are regenerated or recast.

`node scripts/build-synth-library.mjs` regenerates the checked-in catalog from the voice bank's current approved/validated human takes, clean robot cues in the season manifest and `guitar-fills.json`. Keep existing sound IDs stable for saved project compatibility. Full source recordings use a small cache; saved projects reference library IDs rather than duplicating the audio.

Eight pads, 16-step live sequencer, three starter patterns, pad mute, sample selection/upload/drop, start/end trim, pitch, reverse, gain, master low-pass/delay, keyboard 1–8 and Space. Stop cancels queued notes and disconnects delay feedback. Background tabs pause deliberately. Audio begins only on interaction.

Projects autosave to IndexedDB in the current browser. Download/open JSON includes custom sample data; import validates all fields and only accepts embedded audio or known factory sound identifiers. Maximum uploaded file: 8 MB / 30 seconds decoded. Samples never upload to a server. Export renders four repetitions of the one-bar pattern into stereo PCM WAV with a tail for long/pitched samples and echo, using the same audio graph as playback.

`node scripts/check-synth.mjs` checks project validation, rhythm timing, presets and WAV encoding. `npm run build` includes `dist/synth/index.html`; existing Express static routing serves `/synth/` and redirects `/synth` to it. Mobile keeps the instrument within the viewport and scrolls only the sequencer grid.

This is an original sampler, not M-VAVE firmware or an FM-1 emulator. No firmware flashing, hardware MIDI, microphone recording or cloud project account is included.
