#!/usr/bin/env node
// tempo-fetch.mjs — companion to summary-to-evidence.mjs: given a trace id (and a
// Tempo base URL), fetch the full trace JSON export and write it as
// `wake_event_trace.json` into the row's k6-run-<ts>/ artifact dir. This closes
// the runbook's Tempo-trace requirement that summary-to-evidence.mjs leaves as a
// TODO (it captures a trace id when one appears; THIS fetches the actual trace).
//
// SCAFFOLD-LEVEL (open-Q #3). The trace is *evidence a human verifies*: this
// script only retrieves + saves it (and a tiny index of its span names), it does
// NOT decide a verdict. The EVIDENCE.md draft's "wake_event_trace.json TODO" is
// satisfied once this has run and a human has eyeballed the parent/child stitch.
//
// USAGE:
//   # explicit trace id + out dir:
//   node post-process/tempo-fetch.mjs \
//     --trace <trace-id> \
//     --out   PROOFS/<SHA>/<ROW>/k6-run-<ts> \
//     [--base https://tempo.dandelion.cult]      # else $TEMPO_BASE_URL
//
//   # OR derive both from a summary.json the harness produced (reads the
//   # captured trace id + reuses --out as the run dir):
//   node post-process/tempo-fetch.mjs --summary summary.json --out <run-dir>
//
// TEMPO API: full trace export is `GET <base>/api/traces/<trace-id>` (OTLP/JSON).
//   ⚠️ PER-DEPLOYMENT ASSUMPTION: the base URL is PER-SEAT. On elliott-seat it is
//   https://tempo.dandelion.cult (an ingress with its own TLS cert — see the
//   `--insecure` note below). Other seats / the old 10.0.0.10:3200 endpoint are
//   DIFFERENT or DEAD; do not hard-code. Pass --base or set TEMPO_BASE_URL.
//
// SECURITY: mirrors summary-to-evidence.mjs. Tempo is on the tailnet/cluster, not
// public. No gateway token is involved here (Tempo has its own access path); if a
// future Tempo needs a bearer, read it from env (TEMPO_BEARER) — NEVER inline,
// NEVER write it into the artifact. Any value matching a known secret env var is
// scrubbed from what we persist, defensively.

import fs from 'node:fs';
import path from 'node:path';

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
function flag(name) {
  return process.argv.includes(`--${name}`);
}

// ---- inputs ---------------------------------------------------------------
const summaryPath = arg('summary');
const outDir = arg('out');
const baseRaw = arg('base', process.env.TEMPO_BASE_URL || 'https://tempo.dandelion.cult');
// Ingress certs on the fleet are self-signed-ish; allow opting into skip-verify
// the way the runbook's `curl -sk` does. Default is VERIFY (secure by default);
// pass --insecure to mirror `curl -k` for a self-signed ingress.
const insecure = flag('insecure') || process.env.TEMPO_INSECURE === '1';

if (!outDir) {
  console.error('ERROR: --out <k6-run dir> is required (where wake_event_trace.json is written).');
  process.exit(2);
}
const base = String(baseRaw).replace(/\/+$/, ''); // trim trailing slash

// Resolve the trace id: explicit --trace wins, else dig it out of a summary.json
// (the harness stashes it at result.facts.receipts.traceId).
let traceId = arg('trace');
if (!traceId && summaryPath) {
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    traceId =
      (summary.result &&
        summary.result.facts &&
        summary.result.facts.receipts &&
        summary.result.facts.receipts.traceId) ||
      null;
  } catch (e) {
    console.error(`ERROR: could not read trace id from --summary ${summaryPath}: ${e.message}`);
    process.exit(2);
  }
}

if (!traceId) {
  // No trace id is an HONEST state, not a crash: the row may not have surfaced a
  // trace (token-form/preflight), or the gateway frame shape didn't expose one.
  // Leave a breadcrumb so the human knows to capture it manually, then exit 0.
  const note =
    'No trace id available (none passed via --trace and none found in --summary). ' +
    'If this row should have a trace, capture it manually from the gateway frames ' +
    `or Tempo search, then re-run: node tempo-fetch.mjs --trace <id> --out ${outDir}`;
  ensureDir(outDir);
  fs.writeFileSync(
    path.join(outDir, 'wake_event_trace.MISSING.txt'),
    note + '\n' + `# Tempo search: ${base}/api/search?q=...\n`,
  );
  console.log(note);
  process.exit(0);
}

// ---- defensive secret scrub (parity with summary-to-evidence.mjs) ---------
const secretEnvNames = ['OPENCLAW_GATEWAY_TOKEN', 'TEMPO_BEARER'];
const secretVals = secretEnvNames.map((n) => process.env[n]).filter(Boolean);
function scrub(s) {
  if (typeof s !== 'string') return s;
  let out = s;
  for (const v of secretVals) out = out.split(v).join('***REDACTED***');
  return out;
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

// ---- fetch ----------------------------------------------------------------
// Node 18+ has global fetch. For a self-signed ingress (curl -k parity), we flip
// NODE_TLS_REJECT_UNAUTHORIZED only for THIS process when --insecure is set, and
// we say so loudly. (A cleaner future option is a pinned CA via NODE_EXTRA_CA_CERTS.)
if (insecure) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn(
    'WARN: --insecure set — TLS verification DISABLED for this fetch (curl -k parity). ' +
      'OK for a known self-signed fleet ingress on the tailnet; NEVER for a public endpoint.',
  );
}

const url = `${base}/api/traces/${encodeURIComponent(traceId)}`;
const headers = {};
if (process.env.TEMPO_BEARER) headers.Authorization = `Bearer ${process.env.TEMPO_BEARER}`; // from env only

async function main() {
  ensureDir(outDir);
  console.log(`Fetching trace ${traceId}`);
  console.log(`  GET ${url}`);

  let res;
  try {
    res = await fetch(url, { headers });
  } catch (e) {
    // Network/DNS/TLS failure: HONEST-LIMIT, not a verdict. Write a breadcrumb.
    const msg = `Tempo fetch FAILED (network/TLS): ${e.message}. base=${base} (per-seat — correct one set?). ` +
      (insecure ? '' : 'If the ingress is self-signed, retry with --insecure.');
    fs.writeFileSync(path.join(outDir, 'wake_event_trace.ERROR.txt'), scrub(msg) + '\n');
    console.error(`ERROR: ${msg}`);
    process.exit(1);
  }

  if (!res.ok) {
    const body = await safeText(res);
    const msg = `Tempo returned HTTP ${res.status} for trace ${traceId}. ` +
      (res.status === 404
        ? 'A 404 often means the trace has not been ingested yet (wait + retry) or the id is wrong.'
        : 'Check the base URL / auth.');
    fs.writeFileSync(
      path.join(outDir, 'wake_event_trace.ERROR.txt'),
      scrub(`${msg}\n--- response body (truncated) ---\n${body.slice(0, 4000)}`) + '\n',
    );
    console.error(`ERROR: ${msg}`);
    process.exit(1);
  }

  const text = await res.text();
  let traceJson;
  try {
    traceJson = JSON.parse(text);
  } catch {
    // Persist the raw body anyway so nothing is lost; flag it.
    fs.writeFileSync(path.join(outDir, 'wake_event_trace.raw.txt'), scrub(text));
    console.error('ERROR: Tempo response was not JSON; wrote wake_event_trace.raw.txt for inspection.');
    process.exit(1);
  }

  // Persist the full trace (the evidence).
  const tracePath = path.join(outDir, 'wake_event_trace.json');
  fs.writeFileSync(tracePath, scrub(JSON.stringify(traceJson, null, 2)));

  // Tiny, human-friendly index of span names + counts so EVIDENCE.md review is
  // quick (the human still reads the full trace; this just orients them).
  const idx = summarizeTrace(traceJson, traceId, url);
  fs.writeFileSync(path.join(outDir, 'wake_event_trace.index.json'), JSON.stringify(idx, null, 2));

  console.log(`Wrote: ${path.basename(tracePath)} (${idx.spanCount} spans across ${idx.serviceCount} service(s))`);
  console.log(`Index: wake_event_trace.index.json`);
  console.log('\nNEXT (human): open wake_event_trace.json + confirm the parent→child/wake span stitch');
  console.log('matches the transcript before finalizing the EVIDENCE.md verdict.');
}

// ── Verified continuation span-names (🩸 Cael, source-verified 2026-06-21 ──────
// against the actual span-emission source; see VERIFIED-GATEWAY-SURFACE.md §Tempo
// spans). These are the canonical span names tempo-fetch looks for in the trace
// JSON to bind a trace to a continuation row's receipt. SOURCE-EMISSION names —
// a live-trace confirm (fire one continuation → fetch → eyeball) belongs at the
// first SAFE_TO_FIRE run, but the matcher keys on THESE verified names, NOT the
// notes' guesses. (Cael's own catch: `continuation.work-wake` was a GUESS and
// does NOT exist — the real hop-fire span is `continuation.work.fire`.)
export const EXPECTED_CONTINUATION_SPANS = {
  // R-CW (continue_work): hop-fire = the successor-turn receipt
  'continuation.work': 'R-CW work-election (parent schedule/registration)',
  'continuation.work.fire': 'R-CW-1 / R-CW-TOKEN hop-fire receipt (successor turn)',
  // R-CD (continue_delegate)
  'continuation.delegate.dispatch': 'R-CD-1 delegate-spawn span',
  'continuation.delegate.fire': 'R-CD delegate-fire receipt',
  'continuation.queue.enqueue': 'R-CD queue enqueue',
  'continuation.queue.drain': 'R-CD dispatch-time fire (drain)',
  'continuation.queue.fanout': 'tree-broadcast fanout (#1061 territory)',
  // R-RC (request_compaction)
  'continuation.compaction.released': 'R-RC-2 compaction-accept receipt',
  // HONEST-LIMIT (continuation off / policy-blocked)
  'continuation.disabled': 'HONEST-LIMIT signal (continuation disabled / deny-path)',
};

// The per-row attribute key: the tool-execution span carries
// `span.attributes.toolName` = continue_work | continue_delegate | request_compaction.
// A row binds its trace by matching the expected span name AND toolName.
export const TOOL_NAME_ATTR = 'toolName';

// Given the collected span names, report which verified continuation spans are
// PRESENT — orients the human/row reviewer to the receipt straight away
// (e.g. `continuation.work.fire` present ⇒ R-CW hop-fire receipt observed).
// Matches exact names + a dotted-prefix tolerance (some exporters suffix).
export function matchExpectedSpans(spanNames) {
  const present = {};
  const missing = [];
  for (const [span, meaning] of Object.entries(EXPECTED_CONTINUATION_SPANS)) {
    const hit = spanNames.some(
      (n) => n === span || n.startsWith(span + '.') || n.endsWith('.' + span),
    );
    if (hit) present[span] = meaning;
    else missing.push(span);
  }
  return { present, missingCount: missing.length, checkedAgainst: 'VERIFIED-GATEWAY-SURFACE.md §Tempo spans' };
}

// Best-effort body read that never throws.
async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

// Tolerant summary of an OTLP/JSON trace export. The exact envelope can vary
// (resourceSpans vs batches vs data[]); we walk defensively and collect span
// names + service.name attributes without assuming a single shape.
function summarizeTrace(trace, id, fetchedFrom) {
  const spanNames = [];
  const services = new Set();

  // Common Tempo/OTLP shapes: { batches: [...] } or { resourceSpans: [...] } or
  // { data: [ { resourceSpans } ] } or a raw array. Normalize to a list of
  // resource-span-ish containers.
  const containers = [];
  const root = trace && trace.data ? trace.data : trace;
  pushResourceSpans(root, containers);

  for (const rs of containers) {
    const svc = findServiceName(rs);
    if (svc) services.add(svc);
    const scopeSpans = rs.scopeSpans || rs.instrumentationLibrarySpans || [];
    for (const ss of asArray(scopeSpans)) {
      for (const sp of asArray(ss.spans)) {
        if (sp && (sp.name || sp.operationName)) spanNames.push(sp.name || sp.operationName);
      }
    }
  }

  return {
    traceId: id,
    fetchedFrom,
    fetchedAt: new Date().toISOString(),
    spanCount: spanNames.length,
    serviceCount: services.size,
    services: [...services],
    spanNames: spanNames.slice(0, 200), // cap the index; full detail in the .json
    // Which VERIFIED continuation receipt-spans are present (Cael's source-verified
    // names). This is the row-binding signal: e.g. continuation.work.fire present
    // ⇒ the R-CW hop-fire receipt was emitted. Names per VERIFIED-GATEWAY-SURFACE.md.
    continuationReceiptsPresent: matchExpectedSpans(spanNames),
    note:
      'Span-name index. The continuationReceiptsPresent block flags which VERIFIED ' +
      'continuation receipt-spans (Cael, source-verified) appear; the harness still ' +
      'does not pin the exact OTLP envelope, so the full authoritative trace is ' +
      'wake_event_trace.json + a human confirms the parent/child stitch + a live ' +
      'SAFE_TO_FIRE trace confirms the source-emission names fire as expected.',
  };
}

function pushResourceSpans(node, out) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const n of node) pushResourceSpans(n, out);
    return;
  }
  if (node.resourceSpans) {
    for (const rs of asArray(node.resourceSpans)) out.push(rs);
  }
  if (node.batches) {
    for (const b of asArray(node.batches)) out.push(b);
  }
}

function findServiceName(rs) {
  const attrs = (rs.resource && rs.resource.attributes) || [];
  for (const a of asArray(attrs)) {
    if (a && a.key === 'service.name') {
      const v = a.value || {};
      return v.stringValue || v.string_value || (typeof v === 'string' ? v : null);
    }
  }
  return null;
}

function asArray(x) {
  return Array.isArray(x) ? x : x ? [x] : [];
}

main();
