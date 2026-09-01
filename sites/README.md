# Sites

Each immediate child directory is an independent website deployment root:

```text
sites/
├── wallet-staging.bit.cr/
└── wallet.bit.cr/
```

## Cloudflare Pages project isolation

No framework or build command is required. Configure each Git-integrated Pages project with its own root:

| Project | Root directory | Build output directory | Custom domain |
| --- | --- | --- | --- |
| Wallet staging | `sites/wallet-staging.bit.cr` | `.` | `wallet-staging.bit.cr` |
| Wallet production | `sites/wallet.bit.cr` | `.` | `wallet.bit.cr` |

## Wallet Universal Links and Android App Links

| Environment | Pages root | HTTPS host | iOS application identifier | Android package | Custom-scheme fallback |
| --- | --- | --- | --- | --- | --- |
| Staging | `sites/wallet-staging.bit.cr` | `wallet-staging.bit.cr` | `85W65YFC4J.org.bitcr.wallet.staging` | `org.bitcr.wallet.staging` | `bcrwallet-staging://` |
| Production | `sites/wallet.bit.cr` | `wallet.bit.cr` | `85W65YFC4J.org.bitcr.wallet` | `org.bitcr.wallet` | `bcrwallet://` |

Development intentionally has no website association. It continues to use only `bcrwallet-dev://`.

Both hosted environments support the same URL contract:

```text
https://<host>/pay/<payload>
https://<host>/receive/<payload>
https://<host>/contact/<payload>
```

The browser fallback also accepts `https://<host>/pay/?data=<payload>`, `https://<host>/receive/?data=<payload>` and `https://<host>/contact/?data=<payload>` during the compatibility period. It never renders the payload or calls analytics/network APIs. It replaces the current history entry with `/pay/`, `/receive/` or `/contact/` before offering the custom-scheme button. This reduces exposure after the initial request, but it cannot prevent the original URL from reaching browser history or Cloudflare request metadata. Links carrying redeemable value should move to short-lived opaque identifiers rather than bearer-like data in a future protocol revision.

For new links, `/pay`, `/receive` and `/contact` are part of the routing contract, not decorative path labels. The app should validate that the decoded payload action is compatible with the path action and reject mismatches instead of silently routing from the JSON action alone. Any payload-only legacy behavior should remain an explicit compatibility path with separate tests.

### Contact links

`/contact/<payload>` is the "add this person to my contacts" action. The payload carries the wallet ID being shared; the recipient supplies the display name. The app should open its create-contact screen with the wallet ID prefilled and focus the name field, so the only required input is the name. It must not create the contact silently: the screen is a confirmation step, and an unattended write would let any link add entries to the contact list.

Unlike `/pay` and `/receive`, a contact payload is not redeemable value, so a leaked contact link cannot move funds. It is still identifying data about both parties, which is why `/contact/*` keeps the same `no-store`, `no-referrer`, noindex and URL-stripping treatment as the payload routes rather than being treated as a public page.

The app should reject a contact payload whose wallet ID is malformed or is the user's own wallet ID, instead of creating an unusable or self-referential contact. If the wallet ID already exists in the contact list, prefer opening the existing contact over creating a duplicate.

### Root landing and install links

The root URL is intentionally a web landing page and is not claimed by the app. Only actionable `/pay/*`, `/receive/*` and `/contact/*` URLs are configured as Universal/App Links. Installed users can launch the wallet using the explicit “Open wallet” button.

The current launch and installation destinations are:

- Production “Open wallet”: `bcrwallet://open`.
- Production Android install: [Google Play](https://play.google.com/store/apps/details?id=org.bitcr.wallet).
- Production iOS install: [public TestFlight beta](https://testflight.apple.com/join/EjhdhNFh).
- Staging “Open wallet”: `bcrwallet-staging://open`; staging builds remain tester-distributed.

If the product later decides that every `wallet.bit.cr` link should represent “open wallet,” including `/` in the app associations would also be valid, but that is a different user-experience decision.

On mobile, the relevant install option is emphasized. Desktop visitors see a locally generated QR code above the available platform listings. The production QR opens `https://wallet.bit.cr/`; the staging QR opens `https://wallet-staging.bit.cr/`. No external QR service or tracking redirect is involved. The same production install options appear on `/pay/*`, `/receive/*` and `/contact/*` browser fallbacks after the sensitive payload has been removed from the visible URL.

Both isolated wallet deployments include a copy of the wallet icon from `static/wallet/assets/icon.png`. The copy is required because a Cloudflare Pages project rooted under `sites/` cannot read files from the separate `static/` deployment root.

Using the public TestFlight URL is appropriate while iOS remains a beta, but it must be labeled as TestFlight rather than as an App Store release. Apple Smart App Banners require the production App Store's numeric Apple ID and cannot target a TestFlight invitation.

The pages mirror the colors, typography, card and button conventions from [`BitcreditProtocol/ui`](https://github.com/BitcreditProtocol/ui). They intentionally do not install the React component package: these are small static fallback pages, while the published UI library requires React and a build step. Keep the CSS token block synchronized when the design system changes. If the UI repository later publishes a framework-independent token stylesheet, replace the mirrored block with that versioned build artifact.

The wallet app must explicitly handle custom-scheme host `open` as a home action. Root HTTPS URLs remain browser-only.

### Deployment identities

The production and staging Android app-signing SHA-256 certificate fingerprints are configured in their respective `assetlinks.json` files. Both environments authorize their store signing certificate and the CI signing certificate used for directly distributed APKs.

If a signing key changes, update the association file and its expected fingerprint list in both validation scripts. Only retain fingerprints for APKs that should open App Links in that environment.

The production root HTML also contains the inactive future marker `REPLACE_WITH_APPLE_APP_STORE_ID`. It is inside a comment and does not block the TestFlight-based deployment. When the production App Store listing is public, replace it with the numeric Apple ID, enable the `apple-itunes-app` meta tag, and replace the TestFlight URL in `sites/wallet.bit.cr/site-config.js` with the App Store listing URL.

No required Android or install-listing placeholders remain: the signing fingerprints, Google Play URL and public TestFlight URL are configured.

The AASA files use the Apple development team currently configured in the wallet project (`85W65YFC4J`). Before production deployment, inspect the signed app's `application-identifier` entitlement and confirm that its prefix and bundle ID exactly match the AASA `appIDs`; legacy Apple accounts can have an App ID prefix that differs from the Team ID.

From the repository root, run structural validation while developing:

```sh
node scripts/validate-wallet-link-sites.mjs
```

Run strict validation after adding the real fingerprints and before every deployment:

```sh
node scripts/validate-wallet-link-sites.mjs --strict
```

### Cloudflare security settings

Keep Web Analytics and third-party scripts disabled. Do not put Access, authentication, redirects, or a managed challenge in front of either `/.well-known/` endpoint. If request logs or Logpush are enabled, establish a retention/redaction policy for `/pay/*`, `/receive/*` and `/contact/*`; static Pages files cannot redact the URL before it reaches the edge.

The checked-in `_headers` files provide JSON content types, `no-referrer`, `no-store` on payload routes, a restrictive Content Security Policy, clickjacking protection, and search-engine exclusion. The `_redirects` files internally serve the privacy-safe fallback for `/pay/*`, `/receive/*` and `/contact/*`.

### Deployment validation

After deploying staging, then production, verify each environment separately:

```sh
curl -i https://wallet-staging.bit.cr/.well-known/apple-app-site-association
curl -i https://wallet-staging.bit.cr/.well-known/assetlinks.json
curl -i https://wallet.bit.cr/.well-known/apple-app-site-association
curl -i https://wallet.bit.cr/.well-known/assetlinks.json
```

Each association endpoint must return `HTTP 200` directly, without redirects, authentication, or a challenge, and with `Content-Type: application/json`.

The automated post-deployment check also verifies association identities, real fingerprint syntax, fallback rewrites, payload non-disclosure, and security headers:

```sh
node scripts/validate-wallet-link-deployment.mjs wallet-staging.bit.cr
node scripts/validate-wallet-link-deployment.mjs wallet.bit.cr
```

For Android, install the correctly signed build and re-run verification:

```sh
adb shell pm verify-app-links --re-verify org.bitcr.wallet.staging
adb shell pm get-app-links org.bitcr.wallet.staging

adb shell pm verify-app-links --re-verify org.bitcr.wallet
adb shell pm get-app-links org.bitcr.wallet
```

On physical Android and iOS devices, tap `/pay/<payload>`, `/receive/<payload>` and `/contact/<payload>` links with the app fully stopped and again while it is already running. For iOS, do this after the flavor-specific Associated Domains entitlement is present in the signed build, using Notes or Messages as the link source. Apple CDN copies can be inspected at:

```text
https://app-site-association.cdn-apple.com/a/v1/wallet-staging.bit.cr
https://app-site-association.cdn-apple.com/a/v1/wallet.bit.cr
```

Preview deployment hosts are useful for browser-fallback checks, but the mobile apps intentionally do not claim `pages.dev` preview domains.

Roll out staging first. Verify signed staging builds on physical Android and iOS devices, then replace and deploy the production association values, validate both production endpoints, and only then publish the mobile release. Once this repository is deployed, remove the duplicate `.well-known` and fallback files from the wallet repository so this remains the single source of truth.
