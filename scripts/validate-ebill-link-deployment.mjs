import assert from "node:assert/strict";

const environments = {
  "ebill-staging.bit.cr": {
    appID: "85W65YFC4J.org.bitcr.ebills.staging",
    packageName: "org.bitcr.ebills.staging",
    androidAppSigningFingerprints: ["REPLACE_WITH_EBILLS_STAGING_ANDROID_SIGNING_SHA256"],
    scheme: "bcrebill-staging",
    androidInstallUrl: null,
    iosInstallUrl: null,
  },
  "ebill.bit.cr": {
    appID: "85W65YFC4J.org.bitcr.ebills",
    packageName: "org.bitcr.ebills",
    androidAppSigningFingerprints: ["REPLACE_WITH_EBILLS_PROD_ANDROID_SIGNING_SHA256"],
    scheme: "bcrebill",
    androidInstallUrl: "https://play.google.com/store/apps/details?id=org.bitcr.ebills",
    iosInstallUrl: "REPLACE_WITH_EBILLS_APP_STORE_URL",
  },
};
const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const requestedHost = process.argv[2];

if (!requestedHost || !environments[requestedHost]) {
  throw new Error(`Usage: node scripts/validate-ebill-link-deployment.mjs <${Object.keys(environments).join("|")}>`);
}

const environment = environments[requestedHost];

async function get(path) {
  const response = await fetch(`https://${requestedHost}${path}`, {
    redirect: "manual",
    headers: { "user-agent": "bitcredit-ebill-link-validator/1.0" },
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
  ["/contact/*", "/pay/*"],
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
assert.ok(rootBody.includes('src="/ebills-icon.png"'));
assert.ok(rootBody.includes('src="/qr-ebills.png"'));
assert.ok(rootBody.includes(requestedHost));

for (const [path, type] of [
  ["/qr-ebills.png", /^image\/png\b/i],
  ["/ebills-icon.png", /^image\/png\b/i],
  ["/bitcredit-logo.svg", /^image\/svg\+xml\b/i],
  ["/qr.js", /javascript/i],
]) {
  assert.match((await get(path)).headers.get("content-type") ?? "", type, `${path}: unexpected content type`);
}

const siteConfigResponse = await get("/site-config.js");
const siteConfigBody = await siteConfigResponse.text();
assert.ok(siteConfigBody.includes(`customScheme: "${environment.scheme}"`));
for (const installUrl of [environment.androidInstallUrl, environment.iosInstallUrl]) {
  if (installUrl) assert.ok(siteConfigBody.includes(installUrl));
}
assert.doesNotMatch(siteConfigBody, /REPLACE_WITH_/, "site-config.js still carries a placeholder");

// Every link shape the eBills app generates, and therefore every path a
// recipient without the app installed can land on.
const marker = "deployment-validation";
for (const path of [`/contact/?data=${marker}`, `/pay/?bill=${marker}`]) {
  const fallbackResponse = await get(path);
  const fallbackBody = await fallbackResponse.text();
  assert.ok(!fallbackBody.includes(marker), `${path}: fallback response exposed the payload`);
  assert.ok(!fallbackBody.includes("apple-itunes-app"), `${path}: fallback page must not carry a Smart App Banner`);
  assert.equal(fallbackResponse.headers.get("referrer-policy"), "no-referrer");
  assert.match(fallbackResponse.headers.get("cache-control") ?? "", /\bno-store\b/i);
  assert.match(fallbackResponse.headers.get("content-security-policy") ?? "", /default-src 'none'/);
  assert.match(fallbackResponse.headers.get("x-robots-tag") ?? "", /noindex/i);
}

console.log(`Deployment validation passed for ${requestedHost}.`);
