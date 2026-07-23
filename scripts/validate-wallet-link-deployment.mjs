import assert from "node:assert/strict";

const environments = {
  "wallet-staging.bit.cr": {
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
  "wallet.bit.cr": {
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
};
const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const requestedHost = process.argv[2];

if (!requestedHost || !environments[requestedHost]) {
  throw new Error(`Usage: node scripts/validate-wallet-link-deployment.mjs <${Object.keys(environments).join("|")}>`);
}

const environment = environments[requestedHost];

async function get(path) {
  const response = await fetch(`https://${requestedHost}${path}`, {
    redirect: "manual",
    headers: { "user-agent": "bitcredit-wallet-link-validator/1.0" },
  });
  assert.equal(response.status, 200, `${path}: expected HTTP 200 without a redirect`);
  return response;
}

const aasaResponse = await get("/.well-known/apple-app-site-association");
assert.match(aasaResponse.headers.get("content-type") ?? "", /^application\/json\b/i);
const aasa = await aasaResponse.json();
assert.deepEqual(aasa.applinks.details[0].appIDs, [environment.appID]);
assert.deepEqual(
  aasa.applinks.details[0].components.map((component) => component["/"]),
  ["/pay/*", "/receive/*"],
);

const assetLinksResponse = await get("/.well-known/assetlinks.json");
assert.match(assetLinksResponse.headers.get("content-type") ?? "", /^application\/json\b/i);
const assetLinks = await assetLinksResponse.json();
assert.equal(assetLinks[0].target.package_name, environment.packageName);
assert.deepEqual(
  assetLinks[0].target.sha256_cert_fingerprints,
  environment.androidAppSigningFingerprints,
);
assert.ok(
  assetLinks[0].target.sha256_cert_fingerprints.every((value) => fingerprintPattern.test(value)),
  "assetlinks.json contains a missing or malformed app-signing SHA-256 fingerprint",
);

const rootResponse = await get("/");
assert.equal(rootResponse.headers.get("referrer-policy"), "no-referrer");
const rootBody = await rootResponse.text();
assert.ok(rootBody.includes(`${environment.scheme}://open`));
assert.ok(rootBody.includes('src="/wallet-icon.png"'));
assert.ok(rootBody.includes('src="/qr-wallet.png"'));
assert.ok(rootBody.includes(new URL(environment.qrUrl).host));

const qrResponse = await get("/qr-wallet.png");
assert.match(qrResponse.headers.get("content-type") ?? "", /^image\/png\b/i);

const walletIconResponse = await get("/wallet-icon.png");
assert.match(walletIconResponse.headers.get("content-type") ?? "", /^image\/png\b/i);

const siteConfigResponse = await get("/site-config.js");
const siteConfigBody = await siteConfigResponse.text();
assert.ok(siteConfigBody.includes(`customScheme: "${environment.scheme}"`));
if (environment.androidInstallUrl) {
  assert.ok(siteConfigBody.includes(environment.androidInstallUrl));
}
if (environment.iosInstallUrl) {
  assert.ok(siteConfigBody.includes(environment.iosInstallUrl));
}

for (const action of ["pay", "receive"]) {
  const marker = `deployment-validation-${action}`;
  const fallbackResponse = await get(`/${action}/${marker}`);
  const fallbackBody = await fallbackResponse.text();
  assert.ok(!fallbackBody.includes(marker), `${action}: fallback response exposed the payload`);
  assert.equal(fallbackResponse.headers.get("referrer-policy"), "no-referrer");
  assert.match(fallbackResponse.headers.get("cache-control") ?? "", /\bno-store\b/i);
  assert.match(fallbackResponse.headers.get("content-security-policy") ?? "", /default-src 'none'/);
  assert.match(fallbackResponse.headers.get("x-robots-tag") ?? "", /noindex/i);
}

console.log(`Deployment validation passed for ${requestedHost}.`);
