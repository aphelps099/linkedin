# LinkedIn Beats delivery plan

This plan organizes the work without treating new proposals as finished product. Sequence is driven by dependencies: character identity before animation, scene quality before automated scripts, and reliable rendering before public generation.

## Milestones

| Order | Deliverable | Completion criterion | Current status |
| --- | --- | --- | --- |
| 1 | Project foundation | One index linking cast, art, music, drama, tools, assets and roadmap | Created in this revision |
| 2 | Animated human art direction | Two recognizable human studies beside Learn Synergy, reviewed for tone and identity | Initial still study; approval pending |
| 3 | Reusable cast package | Seven human model sheets, stable robot references, layered/rigged assets and short motion tests | Planned |
| 4 | Music package | Three original bed families, separate stems, clear robot voice and beep vocabulary | Existing scores supply references; reusable package planned |
| 5 | Connected office pilot | One finished scene with an objective, relationship tension and continuity to the next episode | Outline proposed |
| 6 | Roast certificate | Previewable artifact with a grounded finding, correct share behavior and distinct identity from Learn completion | Proposed |
| 7 | Meeting creator prototype | Selected topic and user details produce one reviewed, downloadable 30–40 second meeting | Proposed |
| 8 | Public meeting creation | Measured quality/cost, controlled queue, failure recovery, quotas and user-driven publishing | Later |

## First production brief

Develop People & Culture and Operations as animated counterparts to the filmed cast. Compare them next to the existing Learn Synergy, at full image size and in a small meeting tile. Once the visual language is settled, apply it to Kevin and Keys and build the first three-person meeting prototype with Synergy, Kevin and People & Culture.

The initial image is a style study. The next production step is a reference sheet and short motion test, not immediate replacement of the live cast. Keep all existing approved films and avatars available.

## Decisions to settle through review

- How closely should human proportions follow the filmed cast versus the compact Learn avatar?
- Keep role names such as “People & Culture” and “Strategy,” or introduce personal names? Existing names remain until a recast decision is explicit.
- Should the first Roast certificate be stately institutional print, a character-issued credential, or both as variants?
- Does the generator begin with only predefined topics, or a bounded custom topic field too?
- Is visitor measurement important enough to keep GA4 consent UI, or is aggregate-only reporting sufficient? Evaluate the actual collection design before removing the prompt.

## Asset and decision records

Every production asset needs a stable ID, character ID, purpose, source reference, generation/edit provenance, version, approval status and output locations. Large video masters and stems belong in managed media storage; the repo holds manifests, scripts, small previews and direction. Preserve rejected takes when they explain a recurring defect, clearly separated from approved media.

Use `asset-registry.json` as the initial reference index. Runtime catalogs remain authoritative for what actually ships. Record specific approval: “face approved, movement pending” is more useful than a blanket “done.”

## Release practice

Review source changes separately from art studies. Validate links, playback, captions, sharing and exports for the touched feature. Do not redeploy production solely to publish internal development notes. Update the relevant character/art record when a new design becomes approved, and retire superseded guidance rather than letting conflicting directions accumulate.

For measurement, useful future events are beat exported, film completed, certificate downloaded, meeting creation completed and meeting shared. These are a proposed measurement plan, not currently installed custom events. Never send submitted posts, lyrics, names or meeting text as analytics event parameters.
