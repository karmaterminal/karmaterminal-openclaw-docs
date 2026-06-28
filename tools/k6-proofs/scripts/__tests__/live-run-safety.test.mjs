import { test } from "node:test";
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(here, "..", "check-live-run-safety.mjs");

function runWithManifestsDir(dir) {
  // The script reads from <repo>/tools/k6-proofs/manifests by resolving from
  // its own __filename. To test isolation we spawn a controlled copy via
  // node with cwd set, but we cannot easily redirect the relative path
  // without an option. Instead, the test exercises the real script against
  // a real manifest fixture in a tmp tree by symlinking the scripts dir.
  const res = spawnSync(process.execPath, [scriptPath, "--json"], {
    encoding: "utf8",
    cwd: dir,
  });
  return res;
}

test("check-live-run-safety walks repo manifests and exits zero", () => {
  // We run the real script in --json mode against the actual repo manifests.
  // This is a smoke test — we assert that the output is parseable JSON and
  // every row has the expected keys.
  const repoRoot = resolve(here, "..", "..", "..", "..");
  const res = spawnSync(process.execPath, [scriptPath, "--json"], {
    encoding: "utf8",
    cwd: repoRoot,
  });
  assert.equal(res.status, 0, `non-zero exit: ${res.stderr}`);
  const out = JSON.parse(res.stdout);
  assert.ok(out.ok === true, "ok flag should be true on the canonical manifests");
  assert.ok(Array.isArray(out.rows), "rows should be an array");
  assert.ok(out.rows.length > 0, "there should be at least one manifest row");
  for (const r of out.rows) {
    if (r.error) continue;
    assert.ok(typeof r.row === "string", "row id present");
    assert.ok(["A", "B", "C", "D"].includes(r.class), `valid class for ${r.row}`);
    assert.ok(typeof r.mutates === "boolean", "mutates is boolean");
    assert.ok(typeof r.concurrent === "boolean", "concurrent is boolean");
    assert.ok(typeof r.external === "boolean", "external is boolean");
    assert.ok(typeof r.token === "boolean", "token is boolean");
    assert.ok(typeof r.session === "boolean", "session is boolean");
    assert.ok(typeof r.candidate === "boolean", "candidate flag is boolean");
    assert.ok(typeof r.foldReview === "boolean", "foldReview flag is boolean");
    assert.ok(
      [
        "PASS-candidate",
        "PARTIAL-candidate",
        "HONEST-LIMIT-candidate",
        "FAIL-candidate",
        "construct-only",
      ].includes(r.expected),
      `valid expected class for ${r.row}: got ${r.expected}`,
    );
  }
});

test("check-live-run-safety: runnable typed-tool row classifies B (k6-driven live)", () => {
  // Find R-CD-2 (a known runnable typed-tool row) in the output and verify
  // its class.
  const repoRoot = resolve(here, "..", "..", "..", "..");
  const res = spawnSync(process.execPath, [scriptPath, "--json"], {
    encoding: "utf8",
    cwd: repoRoot,
  });
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  const rcd2 = out.rows.find((r) => r.row === "R-CD-2");
  assert.ok(rcd2, "R-CD-2 manifest should be walked");
  assert.equal(rcd2.class, "B", "R-CD-2 should be class B (k6-driven live)");
  assert.equal(rcd2.mutates, false);
  assert.equal(rcd2.concurrent, false, "live continuation rows are not concurrent-safe by default");
});

test("check-live-run-safety: mutates=true row classifies D (config/safety)", () => {
  const repoRoot = resolve(here, "..", "..", "..", "..");
  const res = spawnSync(process.execPath, [scriptPath, "--json"], {
    encoding: "utf8",
    cwd: repoRoot,
  });
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  const rcw5 = out.rows.find((r) => r.row === "R-CW-5");
  assert.ok(rcw5, "R-CW-5 manifest should be walked");
  assert.equal(rcw5.class, "D", "R-CW-5 (cost cap, mutates=true) should be class D");
  assert.equal(rcw5.mutates, true);
});

test("check-live-run-safety: read-only row classifies A (offline/preflight)", () => {
  const repoRoot = resolve(here, "..", "..", "..", "..");
  const res = spawnSync(process.execPath, [scriptPath, "--json"], {
    encoding: "utf8",
    cwd: repoRoot,
  });
  assert.equal(res.status, 0);
  const out = JSON.parse(res.stdout);
  const preflight = out.rows.find((r) => r.row === "preflight");
  assert.ok(preflight, "preflight manifest should be walked");
  assert.equal(preflight.class, "A", "offline preflight should be class A");
  assert.equal(preflight.concurrent, true, "read-only/offline rows are concurrent-safe");
});
