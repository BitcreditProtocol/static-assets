import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const strict = process.argv.includes("--strict");
const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const footerLinks = ["https://opensource.org/license/mit/"];
const removedFooterLinks = [
  "https://static.bit.cr/wallet/privacy-policy/",
  "https://bit.cr/",
  "https://github.com/BitcreditProtocol",
];
// The wallet emits exactly these network segments (`AppConfig.networkNameFor`
// in the wallet repository), and only on the actions whose payload belongs to
// one network. A pay link carries no network segment.
const networkSegments = ["bitcoin", "testnet"];
const networkActions = ["receive", "contact"];

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
    iosInstallUrl: "https://apps.apple.com/app/id6764422592",
    qrUrl: "https://wallet.bit.cr/",
  },
];

const read = (site, relativePath) =>
  readFile(path.join(repositoryRoot, "sites", site.directory, relativePath), "utf8");
const readBinary = (site, relativePath) =>
  readFile(path.join(repositoryRoot, "sites", site.directory, relativePath));

function runFallback(script, { url, action, scheme, siteConfig, withInstallLinks, userAgent = "Desktop" }) {
  let assignedLocation = null;
  let qrText = null;
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
  const status = { dataset: {}, textContent: "" };
  const openInstalled = { hidden: false };
  const desktopQr = { hidden: true };
  const qrCode = {
    children: [],
    replaceChildren(...children) {
      this.children = children;
    },
  };
  const elements = new Map([
    ["open-wallet", button],
    ["open-installed", openInstalled],
    ["status", status],
    ["desktop-qr", desktopQr],
    ["qr-code", qrCode],
  ]);
  const installLinks = [];
  if (withInstallLinks) {
    for (const id of ["android-install", "ios-install"]) {
      const link = { classList, hidden: false, href: "", querySelector: () => null };
      elements.set(id, link);
      installLinks.push(link);
    }
  }
  const svgElement = () => ({
    attributes: {},
    style: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    appendChild() {},
  });
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
    createElementNS: svgElement,
    getElementById(id) {
      return elements.get(id) ?? null;
    },
  };
  const bitcreditQr = {
    encodeText(text) {
      qrText = text;
      return [[true]];
    },
  };

  vm.runInNewContext(script, {
    URL,
    bitcreditQr,
    bitcreditWalletSite: siteConfig,
    document,
    navigator: { maxTouchPoints: 0, platform: "", userAgent },
    window,
  });
  if (clickHandler) clickHandler();

  return {
    assignedLocation,
    button,
    desktopQr,
    installLinks,
    openInstalled,
    qrCode,
    qrText,
    replacedLocation,
    status,
  };
}

function detectLanguage(script, languages) {
  const context = {
    document: {
      documentElement: {},
      getElementById: () => null,
      querySelectorAll: () => [],
    },
    navigator: { languages, language: languages?.[0] },
  };
  vm.runInNewContext(script, context);
  return context.bitcreditI18n.language;
}

function translationKeys(html) {
  return [...html.matchAll(/data-i18n(?:-label)?="([^"]+)"/g)].map((match) => match[1]);
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

  const i18nScript = await read(site, "i18n.js");
  assert.doesNotMatch(i18nScript, /innerHTML|insertAdjacentHTML|document\.write|console\.|fetch\(/);
  assert.equal(detectLanguage(i18nScript, ["es-MX", "en"]), "es");
  assert.equal(detectLanguage(i18nScript, ["de-DE", "es"]), "es");
  assert.equal(detectLanguage(i18nScript, ["en-GB", "es"]), "en");
  assert.equal(detectLanguage(i18nScript, ["fr-FR"]), "en", "an unsupported language must fall back to English");
  assert.equal(detectLanguage(i18nScript, []), "en", "no language preference must fall back to English");
  const i18nContext = {
    document: { documentElement: {}, getElementById: () => null, querySelectorAll: () => [] },
    navigator: { languages: ["en"] },
  };
  vm.runInNewContext(i18nScript, i18nContext);
  const translations = i18nContext.bitcreditI18n.strings;
  assert.deepEqual(Object.keys(translations), ["en", "es"]);
  assert.deepEqual(
    Object.keys(translations.es).sort(),
    Object.keys(translations.en).sort(),
    `${site.host}: English and Spanish must translate the same keys`,
  );
  // Strings are rendered as text with "\n" as the only markup.
  for (const text of Object.values(translations).flatMap(Object.values)) {
    assert.doesNotMatch(text, /[<>]/);
  }

  const qrScript = await read(site, "qr.js");
  assert.doesNotMatch(qrScript, /console\.|fetch\(|sendBeacon|XMLHttpRequest|location/);
  const qrContext = { TextEncoder };
  vm.runInNewContext(qrScript, qrContext);
  assert.equal(qrContext.bitcreditQr.encodeText("a".repeat(17)).length, 21);
  assert.equal(qrContext.bitcreditQr.encodeText("a".repeat(18)).length, 25);
  assert.equal(qrContext.bitcreditQr.encodeText("a".repeat(2953)).length, 177);
  assert.equal(qrContext.bitcreditQr.encodeText("a".repeat(2954)), null);

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
  assert.ok(rootHtml.includes('src="/bitcredit-logo.svg"'));
  assert.ok(rootHtml.includes('src="/qr-wallet.png"'));
  assert.ok(rootHtml.includes(new URL(site.qrUrl).host));
  const qrPng = await readBinary(site, "qr-wallet.png");
  assert.deepEqual([...qrPng.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const walletIconPng = await readBinary(site, "wallet-icon.png");
  assert.deepEqual([...walletIconPng.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  for (const footerLink of footerLinks) assert.ok(rootHtml.includes(footerLink));
  for (const footerLink of removedFooterLinks) assert.ok(!rootHtml.includes(footerLink));

  const notFoundHtml = await read(site, "404.html");
  for (const [name, html] of [["index.html", rootHtml], ["404.html", notFoundHtml]]) {
    assert.ok(html.includes('src="/i18n.js"'), `${site.host}: ${name} must load i18n.js`);
    assert.ok(html.includes('id="language-switch"'), `${site.host}: ${name} must offer the language switch`);
    for (const key of translationKeys(html)) {
      assert.ok(Object.hasOwn(translations.en, key), `${site.host}: ${name} uses unknown translation key ${key}`);
    }
  }
  assert.ok(notFoundHtml.includes('src="/bitcredit-logo.svg"'));
  for (const footerLink of footerLinks) assert.ok(notFoundHtml.includes(footerLink));
  for (const footerLink of removedFooterLinks) assert.ok(!notFoundHtml.includes(footerLink));
  if (site.directory === "wallet.bit.cr") {
    assert.ok(rootHtml.includes(site.androidInstallUrl));
    assert.match(
      rootHtml,
      /^\s*<meta name="apple-itunes-app" content="app-id=6764422592, app-argument=https:\/\/wallet\.bit\.cr\/">$/m,
      "wallet.bit.cr: root page must carry the Smart App Banner for the production App Store listing",
    );
    assert.doesNotMatch(rootHtml, /<!--[^>]*apple-itunes-app/, "wallet.bit.cr: Smart App Banner must not be commented out");
    for (const action of ["pay", "receive", "contact"]) {
      assert.ok(
        !(await read(site, `${action}/index.html`)).includes("apple-itunes-app"),
        `wallet.bit.cr: ${action} fallback page must not carry a Smart App Banner`,
      );
    }
  }

  for (const action of ["pay", "receive", "contact"]) {
    const html = await read(site, `${action}/index.html`);
    assert.ok(html.includes(`data-action="${action}"`));
    assert.ok(html.includes(`data-scheme="${site.scheme}"`));
    assert.ok(html.includes('src="/bitcredit-logo.svg"'));
    assert.ok(html.includes('src="/qr.js"'));
    assert.ok(html.includes('id="language-switch"'));
    assert.ok(html.indexOf('src="/i18n.js"') !== -1);
    assert.ok(html.indexOf('src="/i18n.js"') < html.indexOf('src="/fallback.js"'));
    for (const key of translationKeys(html)) {
      assert.ok(Object.hasOwn(translations.en, key), `${site.host}: ${action} uses unknown translation key ${key}`);
    }
    for (const key of [`${action}.heading`, `${action}.subtitle`, "link.invalid", "after.heading"]) {
      assert.ok(Object.hasOwn(translations.en, key), `${site.host}: missing translation key ${key}`);
    }
    if (site.directory === "wallet.bit.cr") {
      assert.ok(html.includes(site.androidInstallUrl));
      assert.ok(html.includes(site.iosInstallUrl));
    }
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
    assert.equal(pathResult.qrText, `https://${site.host}/${action}/${encodeURIComponent(pathPayload)}`);
    assert.equal(pathResult.desktopQr.hidden, false);
    assert.equal(pathResult.qrCode.children.length, 1);
    assert.equal(pathResult.openInstalled.hidden, true);

    for (const userAgent of ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "Mozilla/5.0 (Linux; Android 15)"]) {
      const mobileResult = runFallback(fallbackScript, {
        url: `https://${site.host}/${action}/${encodeURIComponent(pathPayload)}`,
        action,
        scheme: site.scheme,
        siteConfig,
        withInstallLinks: site.directory === "wallet.bit.cr",
        userAgent,
      });
      assert.equal(mobileResult.qrText, null);
      assert.equal(mobileResult.desktopQr.hidden, true);
      assert.equal(mobileResult.openInstalled.hidden, false);
      for (const link of mobileResult.installLinks) assert.equal(link.hidden, false);
    }
    assert.equal(
      pathResult.assignedLocation,
      action === "contact"
        ? `${site.scheme}://contact/?nodeId=${encodeURIComponent(pathPayload)}`
        : `${site.scheme}://${action}/${encodeURIComponent(pathPayload)}`,
    );

    const queryPayload = '{"action":"test query"}';
    for (const parameter of action === "contact" ? ["nodeId", "data"] : ["data"]) {
      const queryResult = runFallback(fallbackScript, {
        url: `https://${site.host}/${action}/?${parameter}=${encodeURIComponent(queryPayload)}`,
        action,
        scheme: site.scheme,
        siteConfig,
        withInstallLinks: site.directory === "wallet.bit.cr",
      });
      assert.equal(
        queryResult.assignedLocation,
        action === "contact"
          ? `${site.scheme}://contact/?nodeId=${encodeURIComponent(queryPayload)}`
          : `${site.scheme}://${action}/${encodeURIComponent(queryPayload)}`,
      );
    }

    const invalidResult = runFallback(fallbackScript, {
      url: `https://${site.host}/${action}/`,
      action,
      scheme: site.scheme,
      siteConfig,
      withInstallLinks: site.directory === "wallet.bit.cr",
    });
    assert.equal(invalidResult.button.disabled, true);
    assert.equal(invalidResult.assignedLocation, null);
    assert.equal(invalidResult.qrText, null);
    assert.equal(invalidResult.desktopQr.hidden, true);

    // The app puts the network in the path, so `/<action>/<network>/` has to be
    // a real page: the deployed `_redirects` rewrites do not fire for it.
    if (networkActions.includes(action)) {
      const parameter = action === "contact" ? "nodeId" : "data";

      for (const network of networkSegments) {
        assert.equal(
          await read(site, `${action}/${network}/index.html`),
          html,
          `${site.host}: ${action}/${network}/index.html must be ${action}/index.html verbatim`,
        );

        const networkPayload = '{"action":"test network"}';
        const networkResult = runFallback(fallbackScript, {
          url: `https://${site.host}/${action}/${network}/?${parameter}=${encodeURIComponent(networkPayload)}`,
          action,
          scheme: site.scheme,
          siteConfig,
          withInstallLinks: site.directory === "wallet.bit.cr",
        });
        assert.equal(
          networkResult.assignedLocation,
          action === "contact"
            ? `${site.scheme}://contact/?nodeId=${encodeURIComponent(networkPayload)}&network=${network}`
            : `${site.scheme}://${action}/${encodeURIComponent(networkPayload)}?network=${network}`,
        );

        // A network segment is routing, never the payload: without one the
        // link is incomplete, and offering to open it would hand the app
        // "bitcoin" as a token or a wallet id.
        const bareNetworkResult = runFallback(fallbackScript, {
          url: `https://${site.host}/${action}/${network}/`,
          action,
          scheme: site.scheme,
          siteConfig,
          withInstallLinks: site.directory === "wallet.bit.cr",
        });
        assert.equal(bareNetworkResult.button.disabled, true);
        assert.equal(bareNetworkResult.assignedLocation, null);
      }
    }
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
    read(site, "qr.js"),
    read(site, "i18n.js"),
    read(site, "pay/index.html"),
    read(site, "receive/index.html"),
    read(site, "contact/index.html"),
    ...networkActions.flatMap((action) =>
      networkSegments.map((network) => read(site, `${action}/${network}/index.html`)),
    ),
  ]),
);
assert.doesNotMatch(allFiles.join("\n"), /wallet\.example\.com/);

assert.equal(
  await read(sites[0], "i18n.js"),
  await read(sites[1], "i18n.js"),
  "i18n.js must be identical on every wallet site",
);

console.log(`Validated ${sites.length} wallet link sites${strict ? " in strict mode" : ""}.`);
