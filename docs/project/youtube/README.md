# LinkedIn Beats · YouTube launch kit

Handle: **@linkedinbeats**. Host: **Synergy**. Prepared October 29, 2026.

- Local download hub: http://127.0.0.1:8852/youtube/
- Channel starter ZIP: http://127.0.0.1:8852/youtube/linkedinbeats-channel-starter.zip
- Complete art library ZIP: http://127.0.0.1:8852/youtube/linkedinbeats-art-library.zip
- New episode review room: http://127.0.0.1:8852/series/

These links run on Aaron's computer through the existing port 8852 preview server. Downloaded ZIPs are portable. No YouTube upload or public website publication was performed.

## Upload assets

- [Synergy avatar](assets/synergy-avatar.png): original square PNG, circle-safe face/headset, cobalt paper ground. Imagegen reference edit of the actual Synergy; [provenance](avatar-provenance.json). Quiet resting horizontal green mouth. Static generated art does not replace the exact animated display geometry in `src/meeting-room/synergy-display.js`.
- [Channel banner](assets/youtube-banner.jpg): 2560×1440 JPG, native collage layout with approved real instrument scraps, wordmark and TT Hoves. [Mobile-safe preview](assets/mobile-safe-preview.jpg) is a crop for checking, not the file to upload.
- [Channel description](channel-description.txt): 990 characters including line breaks. Written in Synergy's voice. No publishing cadence promised.
- [Nine thumbnails](assets/thumbnails/): 1280×720 JPG adaptations of the Round 03 approved artwork board. Equal 40px inset on every edge, 96px outer/56px inner radius, rounded artwork, few words and no microtext. Review the match between film and thumbnail before upload. Authenticity Rollout remains a catalog continuity-review candidate.

Add channel links to https://linkedinbeats.com and https://Look-Serious.com.

## Complete library

[Asset manifest](asset-manifest.json): 45 files covering current channel assets, nine thumbnail layouts, five logos, seven canonical cast/printer reference stills, three approved source-art rasters, art notes and earlier paper/cel/watercolor studies. The explorations are labeled separately; they are not approved replacements for the photographic series. Chrome-orange and generic waiting-room studies are excluded from the current thumbnail set. Video masters remain on their separate review pages. Licensed font files are excluded from downloadable archives.

## Rebuild

From the repository root:

```sh
node docs/project/youtube/build-kit.mjs
```

Requires the existing sibling `round-03` source board and `optimizing/paper-meeting-chatgpt/studio/assets/instruments` frame cache. Writes into `../optimizing/youtube/`. Uses local Playwright/Chrome to compose brand assets and export layouts. Copies existing source art; does not regenerate the avatar or spend generation credits.

Official image requirements checked against [YouTube channel branding documentation](https://support.google.com/youtube/answer/10456525?hl=en): banner recommended 2560×1440 and under 6MB; profile PNG/JPG under 15MB. Critical banner content stays within the centered 1544×420 check area.

## Validation

- Avatar 1254×1254; banner 2560×1440; nine thumbnails 1280×720.
- Desktop and 390px mobile hub rendered; no horizontal overflow or browser errors.
- All local download/navigation links passed HEAD checks.
- Three episode pages play and seek correctly; each reports 1920×1080 and 90 seconds.
- Avatar, banner, mobile-safe crop and representative thumbnails visually inspected.
- Nothing uploaded to the YouTube account; artwork is ready for channel setup and review.

The launch kit is also available as a complete local folder at `/Users/ap457/Projects/linkedinbeats-meeting-art/optimizing/youtube/`. The starter ZIP contains channel graphics, nine thumbnails and logos; the full ZIP adds cast references, source art and the exploration archive.
