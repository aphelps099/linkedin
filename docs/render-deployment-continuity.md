# Render deployment continuity

Investigated 28 October 2026 after the user reported a 502 during the carousel release.

## Confirmed cause

The `linkedin-beats` Render web service (`srv-dbcl01uq1p3s73cf6n1g`) runs one Docker instance and has a 1 GB persistent disk mounted at `/data`. It deploys commits from `main` automatically. Its HTTP health-check path is currently unset (Render uses the default TCP probe).

Render explicitly disables zero-downtime deploys on services with an attached persistent disk. The old instance must stop before the replacement starts, because both versions cannot safely mount the same disk. Adding another instance is also unsupported with this disk attachment.

For release `89fb717185f12ab50ff16ce74e7776617fad51d5`, deploy `dep-dbh5b6eq1p3s73asrra0` logs show:

- 20:07:06 UTC: old instance receives SIGTERM.
- 20:07:28 UTC: replacement starts Node.
- 20:07:38 UTC: application begins listening on 8080.
- 20:07:45 UTC: Render reports the service live.

This is roughly 39 seconds from shutdown to the new service being declared live, consistent with the observed 502 during replacement. The build itself ran before the old instance stopped. The npm SIGTERM log lines reflect deployment shutdown, not evidence of an application crash.

## Why the disk cannot simply be removed

The repository has filesystem-backed persistence for:

- newsletter records (`server/newsletter.js`, directory configured by `NEWSLETTER_DATA_DIR`);
- encrypted LinkedIn authentication/session data (`server/linkedin-session-store.js`; on Render the router defaults to `/data/linkedin-auth`);
- generated voice cache (`POST_BEAT_CACHE_DIR=/data/linkedin-beat-cache` in Dockerfile);
- generated beat videos/metadata (`/data/beat-video-cache` by default).

Newsletter and LinkedIn integration readiness are enabled in production. This investigation did not read subscriber details, tokens, or disk contents. The exact live directory inventory and data volume still need checking as part of a migration. The Cutting Room film originals already use external S3-compatible storage and do not require this disk.

## Recommended durable fix

Make the public web service stateless so Render can start the new version while the old version continues serving requests.

1. Inventory file paths and volumes without exposing subscriber records or tokens. Take a private backup and verify it before any destructive change.
2. Move newsletter records and encrypted session/state records to a shared transactional store such as Postgres. Preserve encryption, TTL expiry, atomic updates, and session consumption semantics.
3. Move generated downloadable video files and their metadata to object storage. Voice files can be a bounded ephemeral cache if regeneration is acceptable; otherwise use object storage for them too.
4. Implement and test the shared-store adapters, migrate existing data with counts/integrity checks, and verify newsletter signup, OAuth session continuity, generated media and expiry behavior against the new store. Do not put credentials in the repo.
5. Prepare a diskless replacement web service using the verified shared stores, configure `/api/health` as its HTTP readiness check, validate on its preview URL, then move the custom domain. Retain the old service/disk for a defined rollback window. Confirm hosting cost and cutover details before provisioning or switching production infrastructure.
6. Verify a subsequent code deploy keeps the previous instance available until the replacement is healthy.

An HTTP health check and direct Node container entrypoint can improve readiness/shutdown handling, but neither removes the attached-disk restriction. A static frontend plus separate API could keep pages online during backend restarts, but the site's server-generated social previews and interactive endpoints must be explicitly routed; this is an architectural alternative, not a drop-in checkbox.

No production storage was deleted or detached in this investigation. No new paid service was provisioned. The sharing-button release still uses the existing disk-backed service and therefore retains its short deployment interruption.

## Verified Render references

- https://render.com/docs/disks#disk-limitations-and-considerations
- https://render.com/docs/deploys#zero-downtime-deploys
- https://render.com/docs/health-checks
