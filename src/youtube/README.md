# YouTube archives

`GET /api/youtube` supplies Archives and the homepage carousel. The Express
server reads the official public Atom feed for `@linkedinbeats`; no API key or
OAuth access is required. Vite uses the same route for local previews.

The feed is refreshed on demand at most once every 15 minutes. Concurrent
requests share one fetch, requests time out after eight seconds, and failed
refreshes retry after one minute while retaining the last good content.
Shorts are identified by YouTube's own `/shorts/` link, never by duration.
Cards open the matching YouTube page; no videos autoplay or load embeds.

YouTube's public feed exposes the latest 15 uploads. `catalog.json` seeds all
17 public uploads verified on November 2, 2026 (the two oldest titles and IDs
were verified on the channel's Videos tab). Incoming uploads merge by ID into
a persistent archive; older items are not dropped when they leave the feed.
The two older seed entries have no publication date because it was not
available in the feed; they sort after dated entries.

The archive is written atomically to `/data/youtube-archive.json` when the
existing Railway volume is present, otherwise `.cache/youtube-archive.json`.
Override with `YOUTUBE_ARCHIVE_FILE` pointing to persistent storage. No new
volume is created by this change. Persistence failures are logged and the
in-memory feed remains available. Redeploying without a persistent volume
loses uploads collected since the seed snapshot.

The public feed cannot backfill an upload that was never observed before it
left the most recent 15. It also cannot signal removal of an older upload.
Set comma-separated `YOUTUBE_EXCLUDE_IDS` to hide deleted or withdrawn clips
from the archive. For a full historical reconciliation at larger channel
volume, migrate collection to YouTube Data API's uploads playlist.

Archives preserves its existing collection and adds Shorts / YouTube videos
filters and search. The homepage mixes two recent Shorts and two recent
videos after every two existing cards. API failure leaves a usable seed
collection and an Archives notice linking to the live channel.

Validation: `node scripts/check-youtube.mjs`,
`node scripts/check-showcase.mjs`, `npm run build`, and browser checks of
Archives filters/search, carousel controls, destination links, and mobile.
