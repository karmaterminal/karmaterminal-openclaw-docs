#!/usr/bin/env node
/**
 * Live-run safety registry walker for k6 PROOFS row manifests.
 *
 * Reads `tools/k6-proofs/manifests/*.json`, classifies each row into one of
 * the four safety classes documented in `LIVE-RUN-SAFETY.md` (A/B/C/D), and
 * prints a maintainer-facing table.
 *
 * The script never mutates manifests. It uses only the manifest fields and
 * inferred defaults; declared `liveRun` blocks override the inference.
 *
 * Exit codes:
 *   0  every manifest is internally consistent
 *   1  at least one manifest declared inconsistent live-run fields
 *
 * Usage:
 *   node tools/k6-proofs/scripts/check-live-run-safety.mjs
 *   node tools/k6-proofs/scripts/check-live-run-safety.mjs --json
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const manifestsDir = resolve(here, "..", "manifests");

const args = process.argv.slice(2);
const wantJson = args.includes("--json");

/**
 * Decide which class the row belongs to.
 * Inputs are the parsed manifest. Heuristics:
 *  - mutates=true => D (config/safety/restart)
 *  - transport=offline OR scenario.status=construct-only => A (offline/preflight)
 *  - status=runnable AND not mutates AND not external => B (k6-driven live)
 *  - status=scaffold/construct-only with live receipts AND not mutates => C
 *      (agent-orchestrated) when liveRun.requiresOutsideK6Orchestration=true
 *  - else => C as a conservative default for live, A for read-only
 */
function classifyRow(manifest) {
  const status = manifest?.scenario?.status ?? "scaffold";
  const mutates = manifest?.mutates === true;
  const transport = manifest?.transport ?? "websocket";
  const toolSurface = manifest?.toolSurface ?? "typed-tool";
  const live = manifest?.liveRun ?? {};
  const externalOrchestration =
    live.requiresOutsideK6Orchestration === true ||
    toolSurface === "bracket-token" ||
    toolSurface === "token" ||
    (status === "scaffold" && toolSurface === "mixed");

  if (mutates) return "D";
  if (transport === "offline" || status === "construct-only") return "A";
  if (toolSurface === "read-only") return "A";
  if (status === "runnable" && !externalOrchestration) return "B";
  if (externalOrchestration) return "C";
  // Conservative default: scaffold rows that are not declared external get C
  // until a maintainer either promotes them to runnable (B) or marks D.
  return "C";
}

/**
 * Infer the live-run flags from heuristics when the manifest does not declare
 * them. Declared fields always win.
 */
function inferLiveRun(manifest, klass) {
  const declared = manifest?.liveRun ?? {};
  const status = manifest?.scenario?.status ?? "scaffold";
  const transport = manifest?.transport ?? "websocket";
  const toolSurface = manifest?.toolSurface ?? "typed-tool";

  const isOffline = transport === "offline" || klass === "A";
  const isLive = !isOffline;
  const isExternal = klass === "C" || klass === "D";

  return {
    requiresLiveGatewayToken:
      declared.requiresLiveGatewayToken ??
      (isLive ? true : false),
    requiresTargetSessionKey:
      declared.requiresTargetSessionKey ??
      (isLive ? true : false),
    requiresOutsideK6Orchestration:
      declared.requiresOutsideK6Orchestration ??
      isExternal,
    safeToRunConcurrently:
      declared.safeToRunConcurrently ??
      (isOffline ? true : false),
    expectedArtifactClass:
      declared.expectedArtifactClass ??
      (status === "runnable" ? "PASS-candidate" : "construct-only"),
    declaredFully:
      "requiresLiveGatewayToken" in declared &&
      "requiresTargetSessionKey" in declared &&
      "requiresOutsideK6Orchestration" in declared &&
      "safeToRunConcurrently" in declared &&
      "expectedArtifactClass" in declared,
  };
}

/**
 * Validate that declared live-run fields do not contradict each other or the
 * manifest's other declarations. We only flag declared inconsistencies; we do
 * not flag rows that simply rely on inference.
 */
function validateConsistency(manifest, klass, eff) {
  const errors = [];
  const declared = manifest?.liveRun ?? {};
  const mutates = manifest?.mutates === true;
  const candidateOnly = manifest?.review?.candidateOnly === true;
  const foldReview = manifest?.review?.foldRequiresReview === true;

  if (!candidateOnly) errors.push("review.candidateOnly must be true");
  if (!foldReview) errors.push("review.foldRequiresReview must be true");

  if (mutates && declared.safeToRunConcurrently === true) {
    errors.push("mutates=true but liveRun.safeToRunConcurrently=true (config-class row cannot run concurrently)");
  }
  if (mutates && declared.requiresOutsideK6Orchestration === false) {
    errors.push("mutates=true but liveRun.requiresOutsideK6Orchestration=false (config mutation needs operator coordination)");
  }
  if (klass === "A" && declared.requiresLiveGatewayToken === false && manifest?.transport !== "offline") {
    // Read-only over WS still needs the token.
    // Soft warning only; not flagged as error.
  }
  if (
    declared.expectedArtifactClass === "PASS-candidate" &&
    manifest?.scenario?.status !== "runnable"
  ) {
    errors.push("expectedArtifactClass=PASS-candidate but scenario.status is not runnable");
  }
  return errors;
}

function listManifests() {
  return readdirSync(manifestsDir)
    .filter((n) => n.endsWith(".json"))
    .sort();
}

function loadManifest(name) {
  const fullPath = join(manifestsDir, name);
  const raw = readFileSync(fullPath, "utf8");
  return JSON.parse(raw);
}

function main() {
  const rows = [];
  let anyError = false;

  for (const name of listManifests()) {
    let manifest;
    try {
      manifest = loadManifest(name);
    } catch (err) {
      rows.push({ file: name, error: `parse: ${err?.message ?? err}` });
      anyError = true;
      continue;
    }

    const klass = classifyRow(manifest);
    const eff = inferLiveRun(manifest, klass);
    const errors = validateConsistency(manifest, klass, eff);
    if (errors.length) anyError = true;
    rows.push({
      file: name,
      row: manifest.rowId ?? "?",
      status: manifest?.scenario?.status ?? "?",
      class: klass,
      mutates: manifest?.mutates === true,
      concurrent: eff.safeToRunConcurrently,
      external: eff.requiresOutsideK6Orchestration,
      token: eff.requiresLiveGatewayToken,
      session: eff.requiresTargetSessionKey,
      expected: eff.expectedArtifactClass,
      declaredFully: eff.declaredFully,
      candidate: manifest?.review?.candidateOnly === true,
      foldReview: manifest?.review?.foldRequiresReview === true,
      errors,
    });
  }

  if (wantJson) {
    process.stdout.write(JSON.stringify({ rows, ok: !anyError }, null, 2) + "\n");
    process.exit(anyError ? 1 : 0);
  }

  // Tabular output
  const header = [
    "row",
    "class",
    "status",
    "mutates",
    "concurrent",
    "external",
    "token",
    "session",
    "expected",
    "declared",
  ];
  const widths = {
    row: 32,
    class: 5,
    status: 14,
    mutates: 7,
    concurrent: 10,
    external: 8,
    token: 5,
    session: 7,
    expected: 24,
    declared: 8,
  };
  function pad(s, w) {
    s = String(s);
    if (s.length >= w) return s.slice(0, w);
    return s + " ".repeat(w - s.length);
  }
  process.stdout.write(
    header.map((h) => pad(h, widths[h])).join(" ") + "\n",
  );
  process.stdout.write(
    header.map((h) => pad("-".repeat(widths[h]), widths[h])).join(" ") + "\n",
  );
  for (const r of rows) {
    if (r.error) {
      process.stdout.write(`${pad(r.file, widths.row)} parse-error: ${r.error}\n`);
      continue;
    }
    process.stdout.write(
      [
        pad(r.row, widths.row),
        pad(r.class, widths.class),
        pad(r.status, widths.status),
        pad(r.mutates ? "yes" : "no", widths.mutates),
        pad(r.concurrent ? "yes" : "no", widths.concurrent),
        pad(r.external ? "yes" : "no", widths.external),
        pad(r.token ? "yes" : "no", widths.token),
        pad(r.session ? "yes" : "no", widths.session),
        pad(r.expected, widths.expected),
        pad(r.declaredFully ? "yes" : "infer", widths.declared),
      ].join(" ") + "\n",
    );
    if (r.errors && r.errors.length) {
      for (const e of r.errors) process.stdout.write(`  ! ${r.row}: ${e}\n`);
    }
  }
  process.stdout.write(
    `\n${rows.length} manifest(s) walked. ${anyError ? "ERRORS present." : "OK."}\n`,
  );
  process.exit(anyError ? 1 : 0);
}

main();
