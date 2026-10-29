# Google Analytics setup

Configured October 29, 2026 for GA4 measurement ID `G-9FMVNPV2DW`, Web stream `16231260274` (LinkedinBeats, https://linkedinbeats.com). The user supplied the stream screenshot and installation snippet. Release verification is pending deployment.

The build injects `/analytics.js` into all Vite HTML entries. The static privacy page includes it explicitly. The loader runs only on linkedinbeats.com/www, loads Google after an explicit analytics opt-in, respects GPC/DNT, disables Google advertising signals, and omits query/fragment data from its configured page location and referrer. Consent can be changed on the privacy page. No creative-tool input events or session replay are installed.

GA4 dashboard follow-up (requires account access): review enhanced measurement: keep pageviews; turn off form interactions and site search unless specifically wanted, and review history-change pageviews for encoded share URLs. This initial scope is page traffic, not custom conversion tracking.

Validation so far: production build passes; Node VM checks cover initial consent, allow, decline, remembered preference, hostname gating, GPC, duplicate protection and sanitized configured URLs. Consent UI and real collection still require browser verification after the real ID is available. Verify one page_view for an opted-in production visit and confirm Realtime in the correct property before reporting analytics active. No claims about historical visits: collection starts only after installation and opt-in.

Official setup: https://support.google.com/analytics/answer/9304153
Consent implementation: https://developers.google.com/tag-platform/security/guides/consent
