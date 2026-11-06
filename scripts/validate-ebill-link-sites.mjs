import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const strict = process.argv.includes("--strict");
const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const placeholderPattern = /REPLACE_WITH_[A-Z0-9_]+/g;
const footerLink = "https://opensource.org/license/mit/";
// The eBills app generates exactly these links (`contactLink` and
// `billPaymentLink` in the app's `lib/utils/ebill_links.dart`) and reads the
// custom-scheme handoff under the same parameter names.
const actions = { contact: "data", pay: "bill" };

const sites = [
  {
    directory: "ebill-staging.bit.cr",
    host: "ebill-staging.bit.cr",
    appID: "85W65YFC4J.org.bitcr.ebills.staging",
    packageName: "org.bitcr.ebills.staging",
    androidAppSigningFingerprints: ["REPLACE_WITH_EBILLS_STAGING_ANDROID_SIGNING_SHA256"],
    scheme: "bcrebill-staging",
    androidInstallUrl: null,
    iosInstallUrl: null,
    staging: true,
  },
  {
    directory: "ebill.bit.cr",
    host: "ebill.bit.cr",
    appID: "85W65YFC4J.org.bitcr.ebills",
    packageName: "org.bitcr.ebills",
    androidAppSigningFingerprints: ["REPLACE_WITH_EBILLS_PROD_ANDROID_SIGNING_SHA256"],
    scheme: "bcrebill",
    androidInstallUrl: "https://play.google.com/store/apps/details?id=org.bitcr.ebills",
    iosInstallUrl: "REPLACE_WITH_EBILLS_APP_STORE_URL",
    staging: false,
  },
];

const read = (site, relativePath) =>
  readFile(path.join(repositoryRoot, "sites", site.directory, relativePath), "utf8");
const readBinary = (site, relativePath) =>
  readFile(path.join(repositoryRoot, "sites", site.directory, relativePath));
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
const isPlaceholder = (value) => typeof value === "string" && value.startsWith("REPLACE_WITH_");

function runFallback(script, { url, action, site, siteConfig, userAgent = "Desktop" }) {
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
  const openHint = { hidden: false };
  const desktopQr = { hidden: true };
  const qrCode = {
    children: [],
    replaceChildren(...children) {
      this.children = children;
    },
  };
  const elements = new Map([
    ["open-app", button],
    ["open-installed", openInstalled],
    ["open-hint", openHint],
    ["status", status],
    ["desktop-qr", desktopQr],
    ["qr-code", qrCode],
  ]);
  const installLinks = {};
  if (!site.staging) {
    for (const id of ["android-install", "ios-install"]) {
      const link = { classList, hidden: id === "ios-install", href: "", querySelector: () => null };
      elements.set(id, link);
      installLinks[id] = link;
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
    body: { dataset: { action, scheme: site.scheme } },
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
    bitcreditEbillSite: siteConfig,
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
    openHint,
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

const placeholders = [];

for (const site of sites) {
  const siteConfigSource = await read(site, "site-config.js");
  const siteConfigContext = {};
  vm.runInNewContext(siteConfigSource, siteConfigContext);
  const siteConfig = siteConfigContext.bitcreditEbillSite;
  assert.equal(siteConfig.customScheme, site.scheme);
  assert.equal(siteConfig.androidPackage, site.packageName);
  assert.equal(siteConfig.androidInstallUrl, site.androidInstallUrl);
  assert.equal(siteConfig.iosInstallUrl, site.iosInstallUrl);
  for (const value of [siteConfig.androidInstallUrl, siteConfig.iosInstallUrl]) {
    if (isPlaceholder(value)) placeholders.push(`${site.host}: site-config.js install link ${value}`);
  }

  const aasa = JSON.parse(await read(site, ".well-known/apple-app-site-association"));
  const aasaDetails = aasa.applinks.details;
  assert.equal(aasaDetails.length, 1, `${site.host}: AASA must authorize one app only`);
  assert.deepEqual(aasaDetails[0].appIDs, [site.appID]);
  assert.deepEqual(
    aasaDetails[0].components.map((component) => component["/"]),
    ["/contact/*", "/pay/*"],
  );

  const assetLinks = JSON.parse(await read(site, ".well-known/assetlinks.json"));
  assert.equal(assetLinks.length, 1, `${site.host}: assetlinks must authorize one app only`);
  assert.equal(assetLinks[0].target.package_name, site.packageName);
  assert.deepEqual(assetLinks[0].relation, ["delegate_permission/common.handle_all_urls"]);
  const fingerprints = assetLinks[0].target.sha256_cert_fingerprints;
  assert.ok(fingerprints.length > 0, `${site.host}: at least one Android fingerprint is required`);
  assert.deepEqual(fingerprints, site.androidAppSigningFingerprints);
  for (const value of fingerprints) {
    if (!fingerprintPattern.test(value)) {
      assert.ok(isPlaceholder(value), `${site.host}: malformed Android fingerprint ${value}`);
      placeholders.push(`${site.host}: assetlinks.json fingerprint ${value}`);
    }
  }

  const redirects = await read(site, "_redirects");
  assert.match(redirects, /^\/contact\/\* \/contact\/index\.html 200$/m);
  assert.match(redirects, /^\/pay\/\* \/pay\/index\.html 200$/m);
  assert.doesNotMatch(redirects, /receive/);

  const headers = await read(site, "_headers");
  for (const requiredHeader of [
    "Content-Security-Policy: default-src 'none';",
    "Referrer-Policy: no-referrer",
    "X-Content-Type-Options: nosniff",
    "X-Frame-Options: DENY",
    "X-Robots-Tag: noindex",
    "Content-Type: application/json; charset=utf-8",
  ]) {
    assert.ok(headers.includes(requiredHeader), `${site.host}: missing ${requiredHeader}`);
  }
  for (const route of ["/contact/*", "/pay/*", "/site-config.js"]) {
    assert.ok(
      headers.includes(`${route}\n  Cache-Control: no-store`),
      `${site.host}: ${route} must be served with no-store`,
    );
  }

  const fallbackScript = await read(site, "fallback.js");
  assert.doesNotMatch(fallbackScript, /console\.|fetch\(|sendBeacon|XMLHttpRequest|innerHTML/);

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
  for (const text of Object.values(translations).flatMap(Object.values)) {
    // Strings are rendered as text with "\n" as the only markup.
    assert.doesNotMatch(text, /[<>]/);
    // These pages are for eBills, not the wallet.
    assert.doesNotMatch(text, /wallet|billetera|e-?cash/i, `${site.host}: wallet wording in "${text}"`);
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
  for (const src of ["/site-config.js", "/landing.js", "/ebills-icon.png", "/bitcredit-logo.svg", "/qr-ebills.png"]) {
    assert.ok(rootHtml.includes(`src="${src}"`), `${site.host}: root page must load ${src}`);
  }
  assert.ok(rootHtml.includes(site.host));
  // No Smart App Banner until the App Store ID is known.
  assert.ok(!rootHtml.includes("apple-itunes-app"));
  assert.deepEqual([...(await readBinary(site, "qr-ebills.png")).subarray(0, 8)], pngSignature);
  assert.deepEqual([...(await readBinary(site, "ebills-icon.png")).subarray(0, 8)], pngSignature);

  const notFoundHtml = await read(site, "404.html");
  for (const [name, html] of [["index.html", rootHtml], ["404.html", notFoundHtml]]) {
    assert.ok(html.includes('src="/i18n.js"'), `${site.host}: ${name} must load i18n.js`);
    assert.ok(html.includes('id="language-switch"'), `${site.host}: ${name} must offer the language switch`);
    assert.ok(html.includes('src="/bitcredit-logo.svg"'));
    assert.ok(html.includes(footerLink));
    for (const key of translationKeys(html)) {
      assert.ok(Object.hasOwn(translations.en, key), `${site.host}: ${name} uses unknown translation key ${key}`);
    }
  }

  if (!site.staging) {
    assert.ok(rootHtml.includes(site.androidInstallUrl));
    // A placeholder listing stays hidden even without JavaScript.
    assert.match(rootHtml, /id="ios-install" href="REPLACE_WITH_[^"]*"[^>]* hidden>/);
  }

  for (const [action, parameter] of Object.entries(actions)) {
    const html = await read(site, `${action}/index.html`);
    assert.ok(html.includes(`data-action="${action}"`));
    assert.ok(html.includes(`data-scheme="${site.scheme}"`));
    for (const src of ["/bitcredit-logo.svg", "/qr.js", "/site-config.js"]) {
      assert.ok(html.includes(`src="${src}"`), `${site.host}: ${action} must load ${src}`);
    }
    assert.ok(html.includes('id="language-switch"'));
    assert.ok(html.includes('id="open-app"'));
    assert.ok(html.indexOf('src="/i18n.js"') !== -1);
    assert.ok(html.indexOf('src="/i18n.js"') < html.indexOf('src="/fallback.js"'));
    assert.ok(html.includes(footerLink));
    assert.ok(!html.includes("apple-itunes-app"));
    for (const key of translationKeys(html)) {
      assert.ok(Object.hasOwn(translations.en, key), `${site.host}: ${action} uses unknown translation key ${key}`);
    }
    for (const key of [`${action}.heading`, `${action}.subtitle`, "link.invalid", "after.heading"]) {
      assert.ok(Object.hasOwn(translations.en, key), `${site.host}: missing translation key ${key}`);
    }
    if (site.staging) {
      assert.ok(!html.includes('id="open-hint"'), `${site.host}: staging pages carry no open hint`);
    } else {
      assert.ok(html.includes(site.androidInstallUrl));
      assert.ok(html.includes('id="open-hint"'));
      assert.match(html, /id="ios-install" href="REPLACE_WITH_[^"]*"[^>]* hidden>/);
    }
    assert.doesNotMatch(html, /requested-link|location\.href|analytics\.(js|google)/i);

    // A contact payload is url-safe base64 JSON, a bill id is opaque; both
    // are handed on with the same parameter name.
    const payload = action === "contact" ? "eyJ0eXBlIjoicGVyc29uIn0" : "bitcrtest1bill-id_+/=";
    const link = `https://${site.host}/${action}/?${parameter}=${encodeURIComponent(payload)}`;
    const target = `${action}/?${parameter}=${encodeURIComponent(payload)}`;

    const desktop = runFallback(fallbackScript, { url: link, action, site, siteConfig });
    assert.equal(desktop.replacedLocation, `/${action}/`, "the payload must be stripped from the address bar");
    assert.equal(desktop.qrText, link);
    assert.equal(desktop.desktopQr.hidden, false);
    assert.equal(desktop.qrCode.children.length, 1);
    assert.equal(desktop.openInstalled.hidden, true);
    assert.equal(desktop.openHint.hidden, true);
    assert.equal(desktop.assignedLocation, `${site.scheme}://${target}`);
    if (!site.staging) {
      assert.equal(desktop.installLinks["android-install"].hidden, false);
      assert.equal(desktop.installLinks["ios-install"].hidden, isPlaceholder(site.iosInstallUrl));
    }

    for (const userAgent of ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "Mozilla/5.0 (Linux; Android 15)"]) {
      const mobile = runFallback(fallbackScript, { url: link, action, site, siteConfig, userAgent });
      assert.equal(mobile.qrText, null);
      assert.equal(mobile.desktopQr.hidden, true);
      assert.equal(mobile.openInstalled.hidden, false);
      assert.equal(mobile.openHint.hidden, false);

      // Android gets an `intent://` link aimed at the eBills package, so a
      // browser that ignores bare custom schemes still opens the app; iOS
      // keeps the custom scheme.
      const fallbackExtra = site.androidInstallUrl && !isPlaceholder(site.androidInstallUrl)
        ? `;S.browser_fallback_url=${encodeURIComponent(site.androidInstallUrl)}`
        : "";
      assert.equal(
        mobile.assignedLocation,
        /Android/.test(userAgent)
          ? `intent://${target}#Intent;scheme=${site.scheme};package=${site.packageName}${fallbackExtra};end`
          : `${site.scheme}://${target}`,
      );
    }

    // The other action's parameter, a path payload or no payload at all is
    // not a link the app generates, so nothing is handed to the app.
    const otherParameter = action === "contact" ? "bill" : "data";
    for (const url of [
      `https://${site.host}/${action}/`,
      `https://${site.host}/${action}/?${otherParameter}=${encodeURIComponent(payload)}`,
      `https://${site.host}/${action}/${encodeURIComponent(payload)}`,
      `https://${site.host}/${action}/?${parameter}=%20`,
    ]) {
      const invalid = runFallback(fallbackScript, { url, action, site, siteConfig });
      assert.equal(invalid.button.disabled, true, `${url} must be rejected`);
      assert.equal(invalid.openHint.hidden, true);
      assert.equal(invalid.assignedLocation, null);
      assert.equal(invalid.qrText, null);
      assert.equal(invalid.desktopQr.hidden, true);
      assert.equal(invalid.status.dataset.i18n, "link.invalid");
      assert.equal(invalid.replacedLocation, `/${action}/`);
    }
  }

  for (const removed of ["receive/index.html", "contact/bitcoin/index.html", "pay/bitcoin/index.html"]) {
    await assert.rejects(read(site, removed), { code: "ENOENT" }, `${site.host}: ${removed} must not exist`);
  }
}

const allFiles = await Promise.all(
  sites.flatMap((site) =>
    [
      ".well-known/apple-app-site-association",
      ".well-known/assetlinks.json",
      "_headers",
      "_redirects",
      "404.html",
      "index.html",
      "landing.js",
      "site-config.js",
      "fallback.js",
      "qr.js",
      "i18n.js",
      "contact/index.html",
      "pay/index.html",
    ].map((file) => read(site, file).then((content) => ({ site, file, content }))),
  ),
);
for (const { site, file, content } of allFiles) {
  assert.doesNotMatch(content, /bcrwallet|org\.bitcr\.wallet|wallet\.bit\.cr|wallet-icon|bitcreditWalletSite/, `${site.host}/${file} refers to the wallet`);
  // Mock fixture ids from the app must never ship in a page.
  assert.doesNotMatch(content, /bitcrmock1/, `${site.host}/${file} carries a mock id`);
}
// Every placeholder is accounted for above, so a new one cannot slip through.
const unaccounted = allFiles.flatMap(({ site, file, content }) =>
  (content.match(placeholderPattern) ?? [])
    .filter((value) => !placeholders.some((entry) => entry.startsWith(site.host) && entry.endsWith(value)))
    .map((value) => `${site.host}/${file}: ${value}`),
);
assert.deepEqual(unaccounted, [], "unexpected placeholders");

for (const file of ["i18n.js", "fallback.js", "qr.js"]) {
  assert.equal(await read(sites[0], file), await read(sites[1], file), `${file} must be identical on every eBills site`);
}

if (placeholders.length > 0) {
  const message = `replace the eBills placeholders before deployment:\n  ${placeholders.join("\n  ")}`;
  if (strict) throw new Error(message);
  console.warn(`WARNING: ${message}`);
}

console.log(`Validated ${sites.length} eBills link sites${strict ? " in strict mode" : ""}.`);
