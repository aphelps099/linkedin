# Learning portal UI

The existing `/program/` course now uses a quiet cream focus-mode shell and
LinkedIn-style practice cards. The site menu exposes it as **Learn**.

- Read, see an example, understand the changes, try it, review the takeaways.
- Earlier content stays in the reading column. Completed controls cannot skip
  later steps. The rail becomes a sticky course menu on narrow screens.
- A sticker is earned at each chapter end. Finishing all five unlocks a
  personalized Certificate of Professional Effort and the saved final post's
  existing beat player. PNG downloads are created locally from SVG artwork.
- Existing `lb_program_v1` progress is retained. Persistence is by chapter;
  reopening an unfinished lesson restarts its walkthrough.

## Implementation captures

Synthetic learner data is used in these browser screenshots.

![Worked example and explanation](lesson-example.jpg)

![Takeaways and earned sticker](lesson-completion.jpg)

![Certificate and sticker collection](certificate.jpg)

## Verification

`npm run check:program`, `npm run check:home2`, and the complete Vite build pass.
The program checks include old progress migration, malformed stored data and
in-memory progress when storage is blocked.

Browser checks covered all five lessons, personalization, generator outputs,
dial changes, quiz feedback and retry, humanizing the original exercise input,
sticker download, certificate gating, a 2400 × 1700 certificate PNG download,
and completed progress after reload. The 390 px iframe check verified the
mobile menu, sticky header, feed layout and absence of horizontal overflow.

The final beat player rendered and accepted play, but its existing vocal
service returned “The vocals couldn’t be prepared.” Audio playback and audio
exports were not verified in this environment. The service is unchanged by
this UI work. Certificate print styles are included; PNG export was the
browser-verified download path.
