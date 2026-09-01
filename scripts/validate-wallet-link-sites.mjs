import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const strict = process.argv.includes("--strict");
const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const footerLinks = [
  "https://bit.cr/",
  "https://github.com/BitcreditProtocol",
];
const removedFooterLinks = ["https://static.bit.cr/wallet/privacy-policy/"];

const sites = [
  {
    directory: "wallet-staging.bit.cr",
    host: "wallet-staging.bit.cr",
    appID: "85W65YFC4J.org.bitcr.wallet.staging",
    packageName: "org.bitcr.wallet.staging",
    androidAppSigningFingerprints: [
      "2B:6E:79:E3:76:5F:33:E4:9A:BD:9D:27:55:81:35:8B:1D:5F:02:99:9F:17:A3:FD:EF:12:F1:E0:B9:93:3B:0C",
      "80:71:37:D5:D0:7B:1F:2C:82:0E:8C:79:CD:4C:13:55:40:09:5F:52:50:1F:9A:DE:FC:A3:3A:48:3F:76:B1:C2",
    ],
    scheme: "bcrwallet-staging",
    androidInstallUrl: null,
    iosInstallUrl: null,
    qrUrl: "https://wallet-staging.bit.cr/",
  },
  {
    directory: "wallet.bit.cr",
    host: "wallet.bit.cr",
    appID: "85W65YFC4J.org.bitcr.wallet",
    packageName: "org.bitcr.wallet",
    androidAppSigningFingerprints: [
      "99:60:73:5F:11:EB:2C:E0:4C:00:81:5C:2F:D8:6E:10:95:B0:D4:01:5A:AA:EC:0D:F9:79:91:60:C6:14:99:35",
      "80:71:37:D5:D0:7B:1F:2C:82:0E:8C:79:CD:4C:13:55:40:09:5F:52:50:1F:9A:DE:FC:A3:3A:48:3F:76:B1:C2",
    ],
    scheme: "bcrwallet",
    androidInstallUrl: "https://play.google.com/store/apps/details?id=org.bitcr.wallet",
    iosInstallUrl: "https://testflight.apple.com/join/EjhdhNFh",
    qrUrl: "https://wallet.bit.cr/",
  },
];

const read = (site, relativePath) =>
  readFile(path.join(repositoryRoot, "sites", site.directory, relativePath), "utf8");
const readBinary = (site, relativePath) =>
  readFile(path.join(repositoryRoot, "sites", site.directory, relativePath));

function runFallback(script, { url, action, scheme, siteConfig, withInstallLinks }) {
  let assignedLocation = null;
  let replacedLocation = null;
  let clickHandler = null;
  const classList = { add() {} };
  const button = {
    disabled: false,
    classList,
    addEventListener(event, handler) {
      assert.equal(event, "click");
      clickHandler = handler;
    },
  };
  const status = { textContent: "" };
  const elements = new Map([
    ["open-wallet", button],
    ["status", status],
  ]);
  if (withInstallLinks) {
    elements.set("android-install", { classList, hidden: false, href: "", textContent: "" });
    elements.set("ios-install", { classList, hidden: true, href: "", textContent: "" });
  }
  const window = {
    location: {
      href: url,
      assign(value) {
        assignedLocation = value;
      },
    },
    history: {
      replaceState(_state, _title, value) {
        replacedLocation = value;
      },
    },
  };
  const document = {
    body: { dataset: { action, scheme } },
    getElementById(id) {
      return elements.get(id) ?? null;
    },
  };

  vm.runInNewContext(script, {
    URL,
    bitcreditWalletSite: siteConfig,
    document,
    navigator: { maxTouchPoints: 0, platform: "", userAgent: "Desktop" },
    window,
  });
  if (clickHandler) clickHandler();

  return { assignedLocation, button, replacedLocation, status };
}

for (const site of sites) {
  const siteConfigSource = await read(site, "site-config.js");
  const siteConfigContext = {};
  vm.runInNewContext(siteConfigSource, siteConfigContext);
  const siteConfig = siteConfigContext.bitcreditWalletSite;
  assert.equal(siteConfig.customScheme, site.scheme);
  assert.equal(siteConfig.androidInstallUrl, site.androidInstallUrl);
  assert.equal(siteConfig.iosInstallUrl, site.iosInstallUrl);

  const aasa = JSON.parse(await read(site, ".well-known/apple-app-site-association"));
  const aasaDetails = aasa.applinks.details;
  assert.equal(aasaDetails.length, 1, `${site.host}: AASA must authorize one app only`);
  assert.deepEqual(aasaDetails[0].appIDs, [site.appID]);
  assert.deepEqual(
    aasaDetails[0].components.map((component) => component["/"]),
    ["/pay/*", "/receive/*", "/contact/*"],
  );

  const assetLinks = JSON.parse(await read(site, ".well-known/assetlinks.json"));
  assert.equal(assetLinks.length, 1, `${site.host}: assetlinks must authorize one app only`);
  assert.equal(assetLinks[0].target.package_name, site.packageName);
  assert.deepEqual(assetLinks[0].relation, ["delegate_permission/common.handle_all_urls"]);
  const fingerprints = assetLinks[0].target.sha256_cert_fingerprints;
  assert.ok(fingerprints.length > 0, `${site.host}: at least one Android fingerprint is required`);
  assert.deepEqual(fingerprints, site.androidAppSigningFingerprints);
  const invalidFingerprints = fingerprints.filter((value) => !fingerprintPattern.test(value));
  if (invalidFingerprints.length > 0) {
    const message = `${site.host}: replace the Android app-signing SHA-256 placeholder before deployment`;
    if (strict) throw new Error(message);
    console.warn(`WARNING: ${message}`);
  }

  const redirects = await read(site, "_redirects");
  assert.match(redirects, /^\/pay\/\* \/pay\/index\.html 200$/m);
  assert.match(redirects, /^\/receive\/\* \/receive\/index\.html 200$/m);
  assert.match(redirects, /^\/contact\/\* \/contact\/index\.html 200$/m);

  const headers = await read(site, "_headers");
  for (const requiredHeader of [
    "Content-Security-Policy:",
    "Referrer-Policy: no-referrer",
    "X-Content-Type-Options: nosniff",
    "X-Frame-Options: DENY",
    "Cache-Control: no-store",
    "Content-Type: application/json; charset=utf-8",
  ]) {
    assert.ok(headers.includes(requiredHeader), `${site.host}: missing ${requiredHeader}`);
  }

  const fallbackScript = await read(site, "fallback.js");
  assert.doesNotMatch(fallbackScript, /console\.|fetch\(|sendBeacon|XMLHttpRequest/);

  const landingScript = await read(site, "landing.js");
  assert.doesNotMatch(
    landingScript,
    /console\.|fetch\(|sendBeacon|XMLHttpRequest|location\.(assign|replace)|setTimeout/,
  );
  const rootHtml = await read(site, "index.html");
  assert.ok(rootHtml.includes(`${site.scheme}://open`));
  assert.ok(rootHtml.includes('src="/site-config.js"'));
  assert.ok(rootHtml.includes('src="/landing.js"'));
  assert.ok(rootHtml.includes('src="/wallet-icon.png"'));
  assert.ok(rootHtml.includes('src="/qr-wallet.png"'));
  assert.ok(rootHtml.includes(new URL(site.qrUrl).host));
  const qrPng = await readBinary(site, "qr-wallet.png");
  assert.deepEqual([...qrPng.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const walletIconPng = await readBinary(site, "wallet-icon.png");
  assert.deepEqual([...walletIconPng.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  for (const footerLink of footerLinks) assert.ok(rootHtml.includes(footerLink));
  for (const footerLink of removedFooterLinks) assert.ok(!rootHtml.includes(footerLink));

  const notFoundHtml = await read(site, "404.html");
  assert.ok(notFoundHtml.includes('src="/wallet-icon.png"'));
  for (const footerLink of footerLinks) assert.ok(notFoundHtml.includes(footerLink));
  for (const footerLink of removedFooterLinks) assert.ok(!notFoundHtml.includes(footerLink));
  if (site.directory === "wallet.bit.cr") {
    assert.ok(rootHtml.includes(site.androidInstallUrl));
    assert.ok(rootHtml.includes("REPLACE_WITH_APPLE_APP_STORE_ID"));
    console.warn(
      "WARNING: wallet.bit.cr: Smart App Banner remains disabled until the production Apple App Store ID is available",
    );
  }

  for (const action of ["pay", "receive", "contact"]) {
    const html = await read(site, `${action}/index.html`);
    assert.ok(html.includes(`data-action="${action}"`));
    assert.ok(html.includes(`data-scheme="${site.scheme}"`));
    assert.ok(html.includes('src="/wallet-icon.png"'));
    assert.doesNotMatch(html, /requested-link|location\.href|analytics\.(js|google)/i);
    for (const footerLink of footerLinks) assert.ok(html.includes(footerLink));
    for (const footerLink of removedFooterLinks) assert.ok(!html.includes(footerLink));

    const pathPayload = '{"action":"test/path"}';
    const pathResult = runFallback(fallbackScript, {
      url: `https://${site.host}/${action}/${encodeURIComponent(pathPayload)}`,
      action,
      scheme: site.scheme,
      siteConfig,
      withInstallLinks: site.directory === "wallet.bit.cr",
    });
    assert.equal(pathResult.replacedLocation, `/${action}/`);
    assert.equal(
      pathResult.assignedLocation,
      `${site.scheme}://${action}/${encodeURIComponent(pathPayload)}`,
    );

    const queryPayload = '{"action":"test query"}';
    const queryResult = runFallback(fallbackScript, {
      url: `https://${site.host}/${action}/?data=${encodeURIComponent(queryPayload)}`,
      action,
      scheme: site.scheme,
      siteConfig,
      withInstallLinks: site.directory === "wallet.bit.cr",
    });
    assert.equal(
      queryResult.assignedLocation,
      `${site.scheme}://${action}/${encodeURIComponent(queryPayload)}`,
    );

    const invalidResult = runFallback(fallbackScript, {
      url: `https://${site.host}/${action}/`,
      action,
      scheme: site.scheme,
      siteConfig,
      withInstallLinks: site.directory === "wallet.bit.cr",
    });
    assert.equal(invalidResult.button.disabled, true);
    assert.equal(invalidResult.assignedLocation, null);
  }
}

const allFiles = await Promise.all(
  sites.flatMap((site) => [
    read(site, ".well-known/apple-app-site-association"),
    read(site, ".well-known/assetlinks.json"),
    read(site, "_headers"),
    read(site, "_redirects"),
    read(site, "404.html"),
    read(site, "index.html"),
    read(site, "landing.js"),
    read(site, "site-config.js"),
    read(site, "fallback.js"),
    read(site, "pay/index.html"),
    read(site, "receive/index.html"),
    read(site, "contact/index.html"),
  ]),
);
assert.doesNotMatch(allFiles.join("\n"), /wallet\.example\.com/);

console.log(`Validated ${sites.length} wallet link sites${strict ? " in strict mode" : ""}.`);
