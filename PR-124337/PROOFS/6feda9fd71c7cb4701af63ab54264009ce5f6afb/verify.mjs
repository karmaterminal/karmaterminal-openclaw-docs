import assert from "node:assert/strict";
import { createHash, createPublicKey, verify } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicKeyDoc = await readJson(path.join(root, "signing-public-key.json"));
const publicKey = createPublicKey({ key: publicKeyDoc.public_key_jwk, format: "jwk" });
const receipts = [
  "run-summary.json",
  "A-GENUINE-ABANDONMENT-CEILING/receipt.json",
  "B-MIXED-FANIN-CANCELLATION/receipt.json",
];

for (const relativePath of receipts) {
  const envelope = await readJson(path.join(root, relativePath));
  const bytes = Buffer.from(stableJson(envelope.payload));
  assert.equal(envelope.signature.algorithm, "Ed25519");
  assert.equal(envelope.signature.payload_sha256, sha256(bytes));
  assert.equal(
    verify(null, bytes, publicKey, Buffer.from(envelope.signature.value_base64, "base64")),
    true,
    `${relativePath}: invalid Ed25519 signature`,
  );
  assert.equal(envelope.payload.verdict, "PASS", `${relativePath}: non-PASS verdict`);
}

const rowA = (await readJson(
  path.join(root, "A-GENUINE-ABANDONMENT-CEILING/receipt.json"),
)).payload;
const rowADurable = await readJson(
  path.join(root, "A-GENUINE-ABANDONMENT-CEILING/durable-state.json"),
);
const rowARestart = await readJson(
  path.join(root, "A-GENUINE-ABANDONMENT-CEILING/restart-state.json"),
);
assert.equal(
  rowA.ordering.predicate,
  "head.received_at < follower.received_at && head.failed_at < follower.completed_at",
);
assert.equal(rowA.ordering.strict, true);
assert.ok(
  rowA.ordering.head_received_at < rowA.ordering.follower_received_at,
  "row A poison head must be admitted before its follower",
);
assert.ok(
  rowA.ordering.head_failed_at < rowA.ordering.follower_completed_at,
  "row A follower must complete strictly after its poison head fails",
);
assert.equal(rowA.dead_letter.failed_reason, "retry-limit-exceeded");
assert.equal(rowA.dead_letter.last_error, "turn-abandoned");
assert.equal(rowA.dead_letter.payload_retained, 1);
assert.equal(rowA.dead_letter.raw_message_sha256, rowA.payload.sha256);
assert.deepEqual(
  rowADurable.ingress_rows
    .filter((row) => row.status === "failed")
    .map((row) => row.event_id),
  [rowA.dead_letter.event_id],
  "row A must contain exactly one dead letter",
);
assert.deepEqual(rowARestart.ingress_rows, rowADurable.ingress_rows);
assert.deepEqual(rowARestart.session_rows, rowADurable.session_rows);
assert.deepEqual(rowA.restart.replayed_ids, []);
assert.equal(rowA.restart.terminal_state_equal, true);

const rowB = (await readJson(
  path.join(root, "B-MIXED-FANIN-CANCELLATION/receipt.json"),
)).payload;
assert.equal(rowB.mixed_fanin.capable_attempts, 0);
assert.equal(rowB.mixed_fanin.legacy_fallback_attempts, 0);
assert.equal(rowB.mixed_fanin.dead_letters, 0);
assert.equal(rowB.explicit_modern.attempts, 0);
assert.equal(rowB.explicit_modern.dead_letters, 0);
assert.equal(rowB.genuine_abandonment_sibling_control.verdict, "PASS");

const diagnosticDirectories = [
  "session-store-scope-failure",
  "timing-helper-failure",
  "projection-helper-failure",
  "sqlite-reopen-byte-failure",
];
for (const directory of diagnosticDirectories) {
  const diagnosticRoot = path.join(root, "diagnostics", directory);
  const envelope = await readJson(path.join(diagnosticRoot, "FAIL.json"));
  const diagnosticKeyDoc = await readJson(path.join(diagnosticRoot, "signing-public-key.json"));
  const diagnosticKey = createPublicKey({
    key: diagnosticKeyDoc.public_key_jwk,
    format: "jwk",
  });
  const bytes = Buffer.from(stableJson(envelope.payload));
  assert.equal(envelope.signature.payload_sha256, sha256(bytes));
  assert.equal(
    verify(null, bytes, diagnosticKey, Buffer.from(envelope.signature.value_base64, "base64")),
    true,
    `${directory}: invalid diagnostic Ed25519 signature`,
  );
  assert.equal(envelope.payload.verdict, "FAIL", `${directory}: expected diagnostic FAIL`);
}

const manifest = await readJson(path.join(root, "proofs-manifest.json"));
assert.equal(manifest.product_sha, "6feda9fd71c7cb4701af63ab54264009ce5f6afb");
assert.equal(manifest.target_exact_execution, true);
assert.deepEqual(manifest.transposed_rows, []);
assert.equal(manifest.rollup.pass, 2);
assert.equal(manifest.rollup.fail, 0);
assert.equal(manifest.docs_harness_sha, rowA.identity.docs_harness_sha);
assert.equal(manifest.harness_sha256, rowA.identity.harness_sha256);

const sums = (await readFile(path.join(root, "SHA256SUMS"), "utf8"))
  .trim()
  .split("\n")
  .filter(Boolean);
for (const line of sums) {
  const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
  assert.ok(match, `invalid SHA256SUMS line: ${line}`);
  const [, expected, relativePath] = match;
  assert.equal(sha256(await readFile(path.join(root, relativePath))), expected, relativePath);
}

const actualFiles = await listFiles(root);
assert.deepEqual(
  actualFiles.filter((file) => file !== "SHA256SUMS").sort(),
  sums.map((line) => line.slice(66)).sort(),
  "SHA256SUMS must enumerate every corpus file except itself",
);

console.log(JSON.stringify({
  event: "pr124337-corpus-verified",
  verdict: "PASS",
  signed_receipts: receipts.length,
  signed_diagnostics: diagnosticDirectories.length,
  files: actualFiles.length,
}));

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path.join(directory, entry.name), relative)));
    } else {
      files.push(relative);
    }
  }
  return files;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
