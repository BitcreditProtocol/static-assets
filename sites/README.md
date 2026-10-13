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

Both hosted environments support the same URL contract. These are the shapes the wallet app generates today (`buildPaymentRequestLink`, `buildTokenClaimLink` and `buildAddContactLink` in `lib/helpers/deeplink_service.dart`):

```text
https://<host>/pay/?data=<payload>
https://<host>/receive/<network>/?data=<payload>
https://<host>/contact/<network>/?nodeId=<wallet id>
```

`<network>` is `bitcoin` or `testnet` (`AppConfig.networkNameFor`). It is a path segment rather than a second query parameter because WhatsApp's and iMessage's link detectors stop linkifying an https link that carries one, leaving it as inert text.

Each of those paths is a real `index.html` — `receive/bitcoin/`, `contact/testnet/` and so on, each a verbatim copy of its action page, enforced by `scripts/validate-wallet-link-sites.mjs`. The `_redirects` rewrites below would make the copies unnecessary, but they are not applied by the live deployment: `/pay/<payload>` and `/contact/bitcoin/` both return the 404 page on production and staging, while `_headers` rules for the same paths do apply. Until someone gets to the bottom of that in the Pages projects, **a new network segment, or a network segment on `/pay/`, needs a matching directory here or every link of that shape 404s.**

The browser fallback also accepts the legacy `https://<host>/pay/<payload>`, `https://<host>/receive/?data=<payload>` and `https://<host>/contact/?data=<payload>` forms during the compatibility period. It never renders the payload as text or calls analytics/network APIs. It replaces the current history entry with `/pay/`, `/receive/` or `/contact/` before offering the custom-scheme button. This reduces exposure after the initial request, but it cannot prevent the original URL from reaching browser history or Cloudflare request metadata. Links carrying redeemable value should move to short-lived opaque identifiers rather than bearer-like data in a future protocol revision.

For new links, `/pay`, `/receive` and `/contact` are part of the routing contract, not decorative path labels. The app should validate that the decoded payload action is compatible with the path action and reject mismatches instead of silently routing from the JSON action alone. Any payload-only legacy behavior should remain an explicit compatibility path with separate tests.

### Contact links

`/contact/<network>/?nodeId=<wallet id>` is the "add this person to my contacts" action. The payload carries the wallet ID being shared; the recipient supplies the display name. Unlike pay and receive it is named `nodeId`, not `data`, and the custom-scheme handoff has to keep that name — the app reads a contact payload only from a `nodeId` parameter (`AppLinkParser._contactLink`), so the "Open wallet" button emits `<scheme>://contact/?nodeId=<wallet id>&network=<network>` rather than putting the payload in the path. The network is passed on so the app can switch networks by itself instead of rejecting the link. The app should open its create-contact screen with the wallet ID prefilled and focus the name field, so the only required input is the name. It must not create the contact silently: the screen is a confirmation step, and an unattended write would let any link add entries to the contact list.

Unlike `/pay` and `/receive`, a contact payload is not redeemable value, so a leaked contact link cannot move funds. It is still identifying data about both parties, which is why `/contact/*` keeps the same `no-store`, `no-referrer`, noindex and URL-stripping treatment as the payload routes rather than being treated as a public page.

The app should reject a contact payload whose wallet ID is malformed or is the user's own wallet ID, instead of creating an unusable or self-referential contact. If the wallet ID already exists in the contact list, prefer opening the existing contact over creating a duplicate.

### Root landing and install links

The root URL is intentionally a web landing page and is not claimed by the app. Only actionable `/pay/*`, `/receive/*` and `/contact/*` URLs are configured as Universal/App Links. Installed users can launch the wallet using the explicit “Open wallet” button.

The current launch and installation destinations are:

- Production “Open wallet”: `bcrwallet://open`.
- Production Android install: [Google Play](https://play.google.com/store/apps/details?id=org.bitcr.wallet).
- Production iOS install: [App Store](https://apps.apple.com/app/id6764422592).
- Staging “Open wallet”: `bcrwallet-staging://open`; staging builds remain tester-distributed.

If the product later decides that every `wallet.bit.cr` link should represent “open wallet,” including `/` in the app associations would also be valid, but that is a different user-experience decision.

Both the App Store and Google Play badges are shown on every device, because the visitor may be reading the link on one device and installing on another. Desktop visitors of the root page see a static QR code above the listings: the production QR opens `https://wallet.bit.cr/`, the staging QR opens `https://wallet-staging.bit.cr/`.

### Action link pages

`/pay/*`, `/receive/*` and `/contact/*` share one layout with three wordings: an e-cash token (`receive`), a payment request (`pay`) and a wallet address (`contact`). Each page names the operation, offers both store badges and tells the visitor to open the same link again once the app is installed and the wallet set up; at that point the Universal/App Link claim opens the app directly and the page is never shown. On a phone a small “Already have the app? Open it now” link uses the custom scheme for the cases where the operating system does not hand a link to the app, such as a link pasted into the browser or opened from an in-app browser.

On desktop the page instead shows a QR code of the action link exactly as it was opened, payload included, so the visitor can continue on their phone. `qr.js` draws it locally into an inline SVG; there is no external QR service, and the link is read once before the payload is stripped from the address bar and history. Because a `receive` QR carries a redeemable e-cash token, anyone who can see or photograph the screen can claim it, in the same way as anyone holding the link. Long tokens get a larger code (up to 288px) so that each module stays about 2px wide. A link longer than a version 40 QR code can hold (2,953 bytes) gets no QR, and the store badges are still shown.

Staging builds are tester-distributed, so the staging pages show an “Open staging wallet” button on phones in place of the store badges.

Both isolated wallet deployments include a copy of the wallet icon from `static/wallet/assets/icon.png`, and the Bitcredit logo, background and store badge artwork exported from the [Wallet design file](https://www.figma.com/design/O3To42rBvE2Hs483nAvlJn/Wallet?node-id=6306-8542). The copies are required because a Cloudflare Pages project rooted under `sites/` cannot read files from the separate `static/` deployment root.

The iOS install link points at the production App Store listing (Apple ID `6764422592`). If a TestFlight invitation URL is ever configured instead, the pages label it as a TestFlight beta rather than as an App Store release. Apple Smart App Banners require the production App Store's numeric Apple ID and cannot target a TestFlight invitation.

The pages mirror the colors, typography, card and button conventions of the Wallet design file and [`BitcreditProtocol/ui`](https://github.com/BitcreditProtocol/ui). They intentionally do not install the React component package: these are small static fallback pages, while the published UI library requires React and a build step. Keep the CSS token block synchronized when the design system changes. If the UI repository later publishes a framework-independent token stylesheet, replace the mirrored block with that versioned build artifact.

The wallet app must explicitly handle custom-scheme host `open` as a home action. Root HTTPS URLs remain browser-only.

### Deployment identities

The production and staging Android app-signing SHA-256 certificate fingerprints are configured in their respective `assetlinks.json` files. Both environments authorize their store signing certificate and the CI signing certificate used for directly distributed APKs.

If a signing key changes, update the association file and its expected fingerprint list in both validation scripts. Only retain fingerprints for APKs that should open App Links in that environment.

The production root HTML carries the `apple-itunes-app` Smart App Banner meta tag for the production App Store listing (Apple ID `6764422592`). The banner is intentionally limited to the root landing page: the `/pay/*`, `/receive/*` and `/contact/*` fallback pages rely on their install buttons instead, because a static page cannot pass the per-link payload as a banner `app-argument`. When the app is already installed, tapping the banner opens the app with `https://wallet.bit.cr/`, which the app must treat as a home action.

No required Android or install-listing placeholders remain: the signing fingerprints, Google Play URL and App Store URL are configured.

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
