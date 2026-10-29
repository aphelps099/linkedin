# Studio edit — version 8

Aaron requested the original Synergy voice, higher-quality source media, calmer camera coverage, stronger consistency with the site's meeting interface, a subtle after-meeting ChatGPT/LinkedIn action, and a more energetic early-1990s paper-collage opening/closing.

## Locked mouth correction

Version 8 corrects Synergy to a fixed-height 1×10 green horizontal EQ row, with 2×2 open eyes using the same six-pixel unit. Vocal energy fills the row from a fixed left edge toward the right; only the right edge moves. This supersedes version 7’s centered expansion. The painter is shared with the live Synergy overlay and older photo templates; a geometry regression check enforces one row, a fixed left edge/height and the full ten-cell peak. No voice, music, edit timing, intro or outro changes. Earlier film exports retain the rejected mouth geometry and are superseded.

## Approved branding and latest refinement

Aaron loves the version 5 intro and outro. Version 6 preserves both compositions and adds three moving photographic scraps to the opening: hands playing keys at 0.625 seconds, Kevin playing guitar at 1.25, and Operations playing drums at 1.875. Each arrives on a successive 96 BPM beat, then settles. Performance plays at normal speed in ivory paper borders with tape, without covering the episode title. The rest of the edit, all voices, the score and hashtag outro are unchanged.

The [story engine](../../story-engine.md) records the approved recurring character tension and a development slate. Next-episode beats are writing proposals, not additional finished footage.

## Review

- http://127.0.0.1:8852/paper-meeting-chatgpt/studio/
- Master: `/Users/ap457/Projects/linkedinbeats-meeting-art/optimizing/paper-meeting-chatgpt/studio/output/chatgpt-meeting-studio-v8.mp4`
- 96 seconds, 1920 × 1080, 24 fps. Local review only.

## Edit

0–2.5 s: quick blue/graph-paper and colored scrap assembly; original LinkedIn Beats logo, TT Hoves and episode title. Paper shadows and textures are native compositing, with brief word arrivals and a settled readable title.

2.5–76.5 s: a stable meeting layout derived from `src/meeting-room/meeting-room.css`. Colors, tile radius, name bars, green active-speaker outline and toolbar follow the site. Most of the conversation remains in gallery view. Four longer passages use a fixed speaker view; no camera zigzag, diagonal split, eye crop, automated pan or animated zoom. A real blink, drum motion and supplied coffee insert remain within their camera tiles. The established forward-feed printer compositor remains continuous.

The existing People & Culture, Operations and Synergy source videos were enhanced to 4096 × 2304. Selected base frames are retained at 2560 × 1440; the camera composites are rendered at double working resolution before the 1080p export. This is AI-assisted enhancement of existing media, not native 4K capture or a claim to recover missing detail. Likeness and source geometry were compared before use. Source task IDs and hashes are in `studio-sources.json`.

76.5–86.5 s: Synergy's existing close laptop plate, played at normal speed. He types “Write a LinkedIn post about removing two onboarding steps.” A draft appears, Copy becomes Copied, and the same text is pasted into a LinkedIn composer. The laptop screen is tracked from rigid bezel features; foreground fingers are held out from the replacement screen. Screen graphics are an illustrative film composite and perform no real account actions.

86.5–90.5 s: static screen detail lets viewers read the post:

> Today, I used ChatGPT to simplify onboarding.
> Two fewer steps. One clearer owner.
> A small change. A more intentional first day.

90.5–96 s: collage hashtags, then hold: `#ContinuousImprovement`, `#PeopleFirst`, `#AIAtWork`. Small LinkedIn Beats wordmark and `linkedinbeats.com` remain in the lower-right corner. The review footer retains the non-affiliation notice and Aaron Phelps / Look-Serious.com credit.

## Voice and score

Keep recorded voice takes 0–22, including original eSpeak Synergy. The meeting's last line is “Just one for reception.” at 76.1229 s. Remove takes 23–25, which explicitly announce the post and its lesson. No new speech is generated. ElevenLabs auditions are rejected, not candidates for later use.

Rebuild the existing original 96 BPM music loop to 96 seconds, retaining the same dialogue ducking approach. Add restrained local key clicks only under the typing/copy/paste action. Target −16 LUFS / −1.5 dBTP. The mix is newly conformed; unlike V3/V4, its full audio bitstream is not identical to V1. Existing spoken performances and their timing through take 22 are reused.

## Reproduce and inspect

Sources reside under the local review's `assets/` directory: the three enhanced video files and `laptop.mp4`. The source manifest records provenance; task outputs can be retrieved by their recorded IDs without regenerating. Versions 1 and 3 supply original takes, score, timing and speech envelopes. Requires project Node dependencies, Chrome, and Python with numpy, scipy, imageio-ffmpeg and opencv-python-headless.

```sh
python docs/project/episodes/chatgpt-onboarding/prepare-studio-edit.py /path/to/paper-meeting-chatgpt/studio
python docs/project/episodes/chatgpt-onboarding/prepare-intro-instruments.py /path/to/paper-meeting-chatgpt/studio
node docs/project/episodes/chatgpt-onboarding/render-studio-video.mjs /path/to/paper-meeting-chatgpt/studio
python docs/project/episodes/chatgpt-onboarding/build-studio-review.py /path/to/paper-meeting-chatgpt/studio
```

Use `--stills` on the renderer for visual review without a full export. Source-frame motion plays at 24 fps. All expensive enhancements are cached; rendering and compositing are local. See `verification-studio-v5.json` for tracking/speech-removal checks and `verification-studio-v8.json` for the corrected export, unchanged audio and current browser checks. Version 5 branding is approved; the new instrument inserts are ready for review.
