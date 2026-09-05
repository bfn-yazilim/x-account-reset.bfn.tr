# X Account Reset

A browser-only tool for selectively cleaning your own X account without deleting the account. React, strict TypeScript and Vite. Version **0.1.0**, MIT licensed.

> **Release limitation:** Direct browser access to X is not verified end-to-end. An unauthenticated OPTIONS request to the token endpoint on 2026-09-05 returned 404 without CORS allow headers. That does not establish the behavior of every authenticated request. The app conservatively disables connection or affected operations when its browser capability probe fails. There is no proxy fallback. Real-account destructive operations have not been exercised.

## Screenshot

_Screenshot placeholder: add a reviewed screenshot of the landing page here before announcing the release._

## Privacy model

No application backend, database, analytics, password collection, client secret, or token proxy. Static files are hosted by Cloudflare Pages; Cloudflare and X still operate servers and may process request metadata. Do not enable Cloudflare Web Analytics, Zaraz, Rocket Loader, or injected scripts for this project.

Access tokens and short-lived OAuth state are stored in `sessionStorage`, scoped to this origin and tab. X receives the token directly in an Authorization header. Account results and task progress stay in React memory. Clear local data and Disconnect remove project-prefixed session data and reload the landing page. They do **not** revoke authorization at X; remove access in X's connected-app settings if needed. Closing a tab ordinarily ends its session, but browser session restoration/duplication can preserve storage. Explicitly disconnect on shared devices.

## Architecture

```text
Cloudflare Pages -- static HTML / JS / CSS --> User's browser
                                                |
                                    React + TypeScript
                                    PKCE + sessionStorage
                                    bounded reset queue
                                                |
                                     HTTPS directly to X
                                                v
                                           X API v2

No Pages Functions / Worker / application server / database / proxy
```

The feature modules under `src/features` handle authentication and reset planning/execution. `src/lib` holds OAuth, storage, typed API access, error handling and pagination. Pages and shared application layout contain the UI. No client router is needed.

## OAuth and X Developer configuration

1. Create an X developer project/app with the necessary API access. Select a **Single Page App (public client)** with OAuth 2.0 enabled. Do not configure a confidential web client or put a client secret in this repository.
2. Register the exact production callback: `https://x-account-reset.bfn.tr/callback/`.
3. For local authentication register `http://127.0.0.1:5173/callback/`. Current X app documentation specifies loopback IP instead of `localhost`. The UI can be viewed at `http://localhost:5173`, but start authentication at `http://127.0.0.1:5173` so origin and session storage match.
4. Enter only the **public Client ID** in the connection form on the landing page. It is saved in this tab's `sessionStorage` when you connect, survives the OAuth round trip, and is removed by Clear local data or Disconnect. No rebuild or server storage is required. `VITE_X_CLIENT_ID` remains an optional public default.
5. Configure allowed read/write permissions and API billing/access in X. Existence of an endpoint does not guarantee that an individual app can use it.

Authorization: `https://x.com/i/oauth2/authorize`. Token exchange: `https://api.x.com/2/oauth2/token`. API base: `https://api.x.com/2`.

The verifier and state use independent 32-byte `crypto.getRandomValues` values. The code challenge uses SHA-256 (`S256`), following RFC 7636. State is compared exactly and consumed once. The callback query is removed from browser history before validation/network activity. State expires after ten minutes; X authorization codes must be exchanged promptly (X documents a 30-second lifetime). No raw token/error response is displayed or logged.

Requested scopes: `tweet.read users.read tweet.write like.read like.write follows.read follows.write`. These cover only the six advertised cleanup capabilities; no DMs, followers modification, profile edits, or posting UI. The X authorization page's example contains a conflicting follows scope spelling; implementation follows the endpoint-specific authentication mapping (`follows.read`, `follows.write`).

`offline.access` is deliberately omitted: no background access is needed. X issues refresh tokens only with that scope, so this release has no automatic refresh. On access-token expiry (normally two hours), requests stop and the user reconnects. The storage interface supports a refresh token for a future explicitly authorized strategy.

## Local development

Requires Node.js 22+ and npm.

```sh
npm ci
cp .env.example .env
npm run dev
```

On PowerShell use `Copy-Item .env.example .env`. Open `http://127.0.0.1:5173`. Enter your public Client ID in the landing page connection form. The form shows the exact callback to register with X. No environment variable is required for the Client ID.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

Vitest covers PKCE's RFC test vector, state rejection, storage/expiry/clearing, pagination/cursor loops/partial errors, rate limit parsing, category selection, confirmation, bounded concurrency, cancellation, failed task states, unavailable items, and ownership enforcement.

## Environment variables

| Variable              | Purpose                                                                           |
| --------------------- | --------------------------------------------------------------------------------- |
| `VITE_X_CLIENT_ID`    | Optional public default; can be entered or overridden in the UI                   |
| `VITE_X_REDIRECT_URI` | Exact same-origin callback, production `https://x-account-reset.bfn.tr/callback/` |
| `VITE_GITHUB_URL`     | Public repository link; defaults to this repository                               |

Every `VITE_*` value is bundled publicly. Never add a secret. `.env` files are ignored. Build again after changing build variables; environment changes do not modify an already built bundle. IDs entered in the UI take effect immediately without rebuilding.

## Cloudflare Pages deployment

This project targets **Cloudflare Pages static hosting**, as requested. GitHub Actions runs validation only; Cloudflare's Git integration performs deployment.

1. Push this repository to GitHub, then in Cloudflare choose **Workers & Pages -> Create application -> Pages -> Import an existing Git repository**.
2. Select the repository and production branch `main`.
3. Framework: React (Vite). Root directory: repository root. Output directory: **`dist`**.
4. Build command: **`npm run typecheck && npm run lint && npm test && npm run build`**. Pages installs dependencies; the committed npm lockfile makes installation reproducible. Tests are in the Pages build command so a separate GitHub CI run cannot race ahead of a failing deployment check.
5. Set `NODE_VERSION=22`, optionally `VITE_X_CLIENT_ID`, `VITE_X_REDIRECT_URI=https://x-account-reset.bfn.tr/callback/`, and optionally `VITE_GITHUB_URL` in production build variables.
6. Save and deploy. No bindings, functions, database, or secrets are required. Leave Client ID unset for preview deployments unless they use a separate registered X app/callback.

`public/_headers` supplies a restrictive CSP, no-referrer, nosniff, clickjacking protection, permissions policy, and no-store for pages. Hashed assets are immutable. `public/_redirects` rewrites both callback variants to the application; the build also creates `dist/callback/index.html` as a static fallback. No arbitrary client routes are required. Verify `/callback/` loads on a fresh direct request before enabling authentication. Callback tokens/codes must never be copied into issue reports or screenshots.

### Custom domain

In your Pages project, add **`x-account-reset.bfn.tr`** under **Custom domains** and complete Cloudflare's DNS setup. Add the domain in Pages first; do not just create an unrelated DNS record. Verify TLS is active, then register the exact trailing-slash callback with X. `CNAME` files and GitHub Pages deployment workflows are intentionally absent because Cloudflare manages the domain association. Keep the production app on the canonical domain; sessions do not transfer from `pages.dev`.

## Supported reset operations

| Category    | Discovery                             | Mutation                                        |
| ----------- | ------------------------------------- | ----------------------------------------------- |
| Posts       | `GET /2/users/:id/tweets`             | `DELETE /2/tweets/:id`                          |
| Replies     | Same timeline, `replied_to` reference | `DELETE /2/tweets/:id`                          |
| Quote posts | Same timeline, `quoted` reference     | `DELETE /2/tweets/:id`                          |
| Reposts     | Same timeline, `retweeted` reference  | `DELETE /2/users/:id/retweets/:source_tweet_id` |
| Likes       | `GET /2/users/:id/liked_tweets`       | `DELETE /2/users/:id/likes/:tweet_id`           |
| Following   | `GET /2/users/:id/following`          | `DELETE /2/users/:id/following/:target_user_id` |

Account identity always comes from `GET /2/users/me`. No user-ID entry field exists. Post deletion additionally requires that a scan verified its `author_id` matches this account. Reposts use the source post ID, never timeline-wrapper deletion. For overlapping references, priority is repost -> reply -> quote -> original, so each entry has exactly one category. Following cleanup never removes followers. Use the app only for your own deliberate cleanup in accordance with X developer rules.

## Scanning and execution

All list endpoints follow pagination cursors. Duplicate items are deduplicated in the plan. Counts mean **discovered items**, never complete historical totals. A failed or partial scan disables its affected categories. Each category has a harmless OPTIONS probe; if direct browser access cannot be confirmed, its destructive control remains disabled. A successful probe does not guarantee entitlement to a write; actual responses remain authoritative.

All categories start unselected. Review shows exact counts in the selected discovered plan. Confirmation must equal `RESET`, case-sensitive and without whitespace. The queue uses configurable bounded concurrency with a conservative default of **one**. Only GET requests retry transient network/5xx errors, with exponential backoff and two retries. Writes have no automatic retry because a lost response may hide a completed deletion.

429 pauses new work and reports exposed rate-limit headers. If headers are unavailable, retry is delayed at least one minute; there is no infinite retry. Authentication, access and network failures also stop new work. 404 marks an item skipped. Stop reset prevents starting further requests; a dispatched request may finish. Requests time out, but no cancellation can reverse an action already received by X. Failed-only retry requires another `RESET`; pending items after a stopped run require a fresh scan/review.

Keep the tab open during cleanup. Background browser throttling, token expiry, connectivity and API credits can interrupt it. There is no automatic cross-session resume and no promise that following will reach zero. All operation details are local and exclude OAuth data.

## Known X API / browser limitations

- Official documentation describes PKCE public clients but does not guarantee CORS on every required endpoint. Local curl OPTIONS testing is **not** browser proof and is not an authenticated test. Connection currently fails closed unless the runtime probe succeeds.
- The probe is intentionally conservative and can yield false negatives if OPTIONS is rejected although another request could work. Do not remove this gate without verifying real browser CORS for the token endpoint and every list/write endpoint from the deployment origin using a dedicated test account.
- CORS response headers must come from X. Adding headers on Cloudflare Pages cannot fix X API CORS. No `no-cors`, browser-security disabling, scraping, cookies, or proxy workaround is provided.
- Timeline endpoints may expose only recent history (X has historically limited this to 3,200 posts); exhausting cursors does not prove complete account cleanup. Likes/source posts can be unavailable, and following may change during a scan.
- Plan/credit availability, rate limits and scopes can change. 403 disables affected scanning features; write failures are reported without inventing support.
- A frontend cannot enforce secrecy against malicious extensions, compromised dependencies, XSS, or someone controlling the device. Static hosting still has delivery servers and provider logs; the project has no application processing backend.

## Security and release verification

Never log tokens, authorization codes, state/verifiers or raw API error bodies. Avoid third-party scripts, injected analytics and unsafe HTML. Remote strings render through React escaping. CSP restricts scripts to this origin and connections to X; the hosting header adds `frame-ancestors`, which a meta CSP cannot enforce. Restrict DNS/Cloudflare/GitHub permissions and require code review before deployments. Run `npm audit` before each release and review dependency changes; do not blindly apply breaking audit fixes.

Before calling a release production-verified, test an actual public X client from the deployed origin: successful and denied callbacks, state mismatch, account discovery, every list endpoint, every individual write on disposable content, CORS failures, expired tokens, 429, stopping during a request, keyboard access and mobile layouts. Those real-account tests need owner-provided credentials and explicit disposable test data. No real account was modified during development.

## Documentation checked

Official sources consulted on 2026-09-05:

- [X OAuth PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)
- [X app types and callback requirements](https://docs.x.com/fundamentals/developer-apps)
- [Endpoint scopes](https://docs.x.com/fundamentals/authentication/guides/v2-authentication-mapping)
- [User posts](https://docs.x.com/x-api/users/get-posts), [likes](https://docs.x.com/x-api/users/get-liked-posts), [following](https://docs.x.com/x-api/users/get-following)
- [Delete post](https://docs.x.com/x-api/posts/delete-post), [reposts](https://docs.x.com/x-api/posts/retweets/introduction), [unlike](https://docs.x.com/x-api/users/unlike-post), [unfollow](https://docs.x.com/x-api/users/unfollow-user)
- [X rate limits](https://docs.x.com/x-api/fundamentals/rate-limits) and [developer guidelines](https://docs.x.com/developer-guidelines)
- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [headers](https://developers.cloudflare.com/pages/configuration/headers/)

## Contributing

Open a focused issue or pull request. Explain the user-visible behavior and validation. Run typecheck, lint, tests, formatting and build. Include tests for security-sensitive changes. Use mock responses for automated tests; never include personal account data or credentials. Report vulnerabilities privately to the repository maintainer, with sensitive data redacted.

## License

[MIT](LICENSE). Independent project, not affiliated with or endorsed by X.

## Hosted release status

The repository is configured for Cloudflare Pages, but no Cloudflare project or live deployment was created by this implementation. Connect the Git repository in your own Cloudflare account. Enter the public Client ID in the deployed app. The browser-only X compatibility limitation remains regardless of hosting provider.
