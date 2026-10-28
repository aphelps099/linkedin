// Curated homepage selection. Art direction: docs/thumbnail-art-notes.md.
// Keep film IDs tied to the Cutting Room catalog; the full production library stays unlisted.
export const showcaseSelection = [
  {id:'room-to-scale', art:'room-scale', title:'Unlocking our collective potential', meeting:'unlock-0'},
  {id:'welcome', art:'welcome', title:'Welcome to the Office', film:'welcome-to-the-office-v6-5adc47bd', duration:'1:00'},
  {id:'quick-sync', art:'synergy', title:'Optimizing the onboarding', meeting:'onboarding-0'},
  {id:'gallery', art:'gallery', title:'What’s everyone working on?', meeting:'standup-0'},
  {id:'on-mute', art:'linda', title:'A seamless first-touch experience', meeting:'onboarding-1'},
  {id:'authenticity', art:'auth', title:'Authenticity Rollout', film:'authenticity-rollout-90-second-version-5733dfd7', duration:'1:30'},
  {id:'caffeinated', art:'coffee', title:'Caffeinated Edition', film:'training-02-caffeinated-edition-0d1af435', duration:'0:50'},
  {id:'same-link', art:'windows', title:'We’ll take this offline', meeting:'offline-0'},
  {id:'circle-back', art:'circle', title:'Let’s Circle Back', film:'let-s-circle-back-synergy-corrected-d6ecf221', duration:'1:30'},
];
export const filmSource = film => `/api/cutting-room/media/${film}.mp4`;
