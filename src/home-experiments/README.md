# Homepage feed concepts

`/home-3/` uses the floating laptop layout; `/home-4/` shows the same conversation without a device. Both use `ConceptHome` with its existing Mux film, actual audio transport, merchandise section, LinkedInifier and footer. The default `/` layout remains the portrait version. Experiment pages are noindex and canonicalize to `/`.

`feed-timeline.js` is the single timing source: two 21-second scenes, a 2.2-second reading pause, 40 reactions through 6.6 seconds, then five comments at 7.1, 8.8, 10.5, 12.2 and 13.9 seconds. The scene holds before a short exit. Each scene has separate manual reaction counts. The feed animation is independent of the audio transport. Explicit pause, post selection, viewport visibility, document visibility and reduced motion are supported. Reduced motion starts with a fully readable static conversation; post selection still works.

The laptop is a CSS frame around real text, not a flattened screenshot. Its display can later host a captured silent Mux video without encoding the page's blue background into the clip. The screenless view uses the same post and comments. The comparison links beneath the player switch views without changing the main navigation.

`public/home-experiments/profile-sheet.jpg` is a format-compressed copy of the generated concept sketch `exec-83fa9121-21d4-4096-9441-7f1dd5bb7787.png` (2026-10-15). CSS windows reuse its fictional small profile portraits. No real profile information or live LinkedIn activity is used.
