#!/usr/bin/env node
/**
 * Review helper for Project 81 R-CW-3 reason telemetry/redaction receipts.
 *
 * This script does not run Gateway work. It inspects an existing R-CW-3 run
 * directory and its fetched Tempo trace JSON, then writes a public-safe review
 * receipt. It automates the repeatable part of the manual review:
 *   - schedule + wake evidence exists
 *   - public k6 artifact says the raw reason was not preserved
 *   - Tempo trace contains safe reason telemetry attrs
 *   - Tempo trace does not contain the raw reason sentinel/prefix
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const RAW_SENTINEL_PREFIX = 'RAW-RCW3-';
const REASON_PREFIX = 'k6-proof-R-CW-3-redaction';

function usage() {
  console.error('Usage: node review-r-cw-3-reason-telemetry.mjs --run-dir <R-CW-3 run dir> [--tempo-trace <trace.json>] [--out <receipt.json>]');
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--run-dir' || arg === '--tempo-trace' || arg === '--out') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
      out[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }
  return out;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function readEvidence(runDir) {
  const evidencePath = path.join(runDir, 'evidence.jsonl');
  const text = await readFile(evidencePath, 'utf8');
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line));
  }
  if (!rows.length) throw new Error(`no evidence rows in ${evidencePath}`);
  return rows[rows.length - 1];
}

async function findTempoTrace(runDir, explicit) {
  if (explicit) return path.resolve(explicit);
  const entries = await readdir(runDir).catch(() => []);
  const matches = entries.filter((name) => /^tempo-trace-[A-Fa-f0-9]{8,64}\.json$/.test(name)).sort();
  if (matches.length === 1) return path.join(runDir, matches[0]);
  if (matches.length > 1) throw new Error(`multiple tempo trace JSON files found in ${runDir}; pass --tempo-trace explicitly`);
  throw new Error(`no tempo-trace-<trace>.json found in ${runDir}; fetch it first or pass --tempo-trace`);
}

function extractAttributes(obj, out = []) {
  if (!obj || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    for (const item of obj) extractAttributes(item, out);
    return out;
  }
  if (typeof obj.key === 'string' && obj.value && typeof obj.value === 'object') {
    out.push({ key: obj.key, value: otelValueToScalar(obj.value) });
  }
  for (const value of Object.values(obj)) extractAttributes(value, out);
  return out;
}

function otelValueToScalar(value) {
  if (!value || typeof value !== 'object') return value;
  for (const key of ['stringValue', 'intValue', 'doubleValue', 'boolValue']) {
    if (Object.prototype.hasOwnProperty.call(value, key)) return value[key];
  }
  if (value.arrayValue) return JSON.stringify(value.arrayValue);
  if (value.kvlistValue) return JSON.stringify(value.kvlistValue);
  return JSON.stringify(value);
}

function allStrings(obj, out = []) {
  if (obj == null) return out;
  if (typeof obj === 'string') { out.push(obj); return out; }
  if (typeof obj === 'number' || typeof obj === 'boolean') { out.push(String(obj)); return out; }
  if (Array.isArray(obj)) { for (const item of obj) allStrings(item, out); return out; }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      out.push(key);
      allStrings(value, out);
    }
  }
  return out;
}

function status(ok, evidence) {
  return { ok, evidence };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { usage(); return; }
  if (!args.runDir) throw new Error('--run-dir is required');
  const runDir = path.resolve(args.runDir);
  const tempoTracePath = await findTempoTrace(runDir, args.tempoTrace);
  const outPath = path.resolve(args.out || path.join(runDir, 'r-cw-3-reason-telemetry-review.json'));

  const evidence = await readEvidence(runDir);
  const trace = await readJson(tempoTracePath);
  const attrs = extractAttributes(trace);
  const strings = allStrings(trace);
  const attrKeys = new Set(attrs.map((a) => a.key));
  const hasReasonPresent = attrs.some((a) => a.key === 'reason.present' && (a.value === true || a.value === 'true'));
  const hasReasonLength = attrKeys.has('reason.length');
  const hasReasonHash = attrKeys.has('reason.hash');
  const hasSafeReasonAttrs = hasReasonPresent && hasReasonLength && hasReasonHash;
  const rawSentinelHits = strings.filter((s) => s.includes(RAW_SENTINEL_PREFIX));
  const rawReasonPrefixHits = strings.filter((s) => s.includes(REASON_PREFIX));
  const rawReasonAbsent = rawSentinelHits.length === 0 && rawReasonPrefixHits.length === 0;

  const checks = {
    row: status(evidence.row === 'R-CW-3', evidence.row || null),
    dispatchAccepted: status(evidence.dispatch_accepted === true, evidence.dispatch_accepted === true),
    scheduledSentinel: status(evidence.scheduled_sentinel === true, evidence.scheduled_sentinel === true),
    wakeObserved: status(evidence.wake_observed === true, evidence.wake_observed === true),
    publicArtifactRawReasonAbsent: status(evidence.public_artifact_raw_reason_absent === true, evidence.public_artifact_raw_reason_absent === true),
    tempoTraceJson: status(Boolean(trace), path.basename(tempoTracePath)),
    safeReasonAttrsPresent: status(hasSafeReasonAttrs, {
      'reason.present': hasReasonPresent,
      'reason.length': hasReasonLength,
      'reason.hash': hasReasonHash,
    }),
    rawReasonAbsentFromTempo: status(rawReasonAbsent, {
      rawSentinelPrefixHits: rawSentinelHits.length,
      rawReasonPrefixHits: rawReasonPrefixHits.length,
    }),
  };
  const passed = Object.values(checks).every((check) => check.ok);
  const receipt = {
    schema: 'openclaw.k6.r-cw-3-reason-telemetry-review.v1',
    generatedAt: new Date().toISOString(),
    runDir,
    tempoTraceJson: tempoTracePath,
    row: 'R-CW-3',
    nonce: evidence.nonce || null,
    traceId: evidence.trace_id || null,
    verdict: passed ? 'reason-telemetry-redaction-review-passed' : 'review-pending',
    checks,
    safeReasonAttributeKeys: attrs.map((a) => a.key).filter((key) => key.startsWith('reason.')).sort(),
    publicSafe: true,
  };
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({ out: outPath, verdict: receipt.verdict, passed }, null, 2));
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  usage();
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
