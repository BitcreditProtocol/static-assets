import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
// The contract propose-wallet-minimum.py in BitcreditProtocol/.github enforces when it reads
// these files: exactly one key, and MAJOR.MINOR.PATCH without leading zeros. Every installed
// wallet reads one of them at start-up, so a hand edit gets the same check here.
const versionPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const environments = ["dev", "staging", "prod"];

for (const environment of environments) {
  const file = path.join("static/wallet/min-version", environment, "min-supported-version.json");
  const parsed = JSON.parse(await readFile(path.join(repositoryRoot, file), "utf8"));
  assert.ok(parsed && typeof parsed === "object" && !Array.isArray(parsed), `${file}: expected a JSON object`);
  assert.deepEqual(Object.keys(parsed), ["min_supported_version"], `${file}: expected exactly one key, min_supported_version`);
  assert.equal(typeof parsed.min_supported_version, "string", `${file}: min_supported_version must be a string`);
  assert.match(parsed.min_supported_version, versionPattern, `${file}: expected MAJOR.MINOR.PATCH without leading zeros`);
}

console.log(`Validated ${environments.length} wallet minimum versions.`);
