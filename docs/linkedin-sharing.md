# LinkedIn direct publishing

Configure `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and `LINKEDIN_REDIRECT_URI=https://linkedinbeats.com/api/auth/linkedin/callback` in Render. Enable Share on LinkedIn and Sign In with LinkedIn using OpenID Connect. Requested scopes: `openid profile w_member_social` (no email). Set the identical redirect URL in the app's Auth settings.

`LINKEDIN_DATA_DIR` optionally sets the private session directory. By default it is `linkedin-auth` beside `NEWSLETTER_DATA_DIR`, or `/data/linkedin-auth` on Render. This must be on the persistent disk. Session files are AES-256-GCM encrypted with a key derived from the server-only client secret; rotating that secret invalidates existing connections. The deployment is single-instance with a mounted disk; use shared storage and distributed locks before scaling to multiple instances. `LINKEDIN_API_VERSION` defaults to `202610` and must be updated before that API version sunsets.

`GET /api/auth/linkedin/status` returns configuration/connection state, account display name, and a session CSRF token. It never returns provider tokens. OAuth uses a ten-minute, single-use browser-bound state. The random session cookie is Secure, HttpOnly, SameSite=Lax, host-only, and expires at the earlier of provider token expiry or 30 days. No refresh token is requested. Expired files are pruned hourly. Disconnect deletes local connection data; users can separately revoke provider authorization in LinkedIn settings.

The share preview keeps the video in memory while an authorization popup opens. Authorization alone never uploads or publishes. An explicit Publish click snapshots the reviewed caption and audience, uploads the selected MP4 or PNG, waits for processing, and creates a member post. The server determines the author from the connected account, never client input. PNG status uses the documented legacy GET route because versioned Images API GET requires broader permissions than `w_member_social`.

Uploads are limited to 12 MB, authenticated before parsing, validated by media signature, and sent only to LinkedIn-owned HTTPS destinations without following redirects. Original bytes are not saved. Uploaded media IDs and deduplication digests are private to the session. A durable sending marker prevents duplicate posts when the provider response is lost or a deploy interrupts publishing. Unknown outcomes require checking LinkedIn; they are never automatically retried. Publishing receipts are kept for at most the connection lifetime. Existing manual/download sharing remains under Other ways to share.

Verification: `node scripts/check-linkedin.mjs` runs isolated provider simulations. `npm run build` verifies both React entry points. A real account must authorize and explicitly publish a test beat and certificate to verify product access and provider processing end to end. No automated test publishes to LinkedIn.

Official references:
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
