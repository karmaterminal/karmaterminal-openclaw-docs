#!/usr/bin/env node
/**
 * Post-processor: transforms k6 evidence JSON into
 * PROOFS/<SHA>/<ROW>/<seat>/k6-run-<timestamp>/ artifacts.
 *
 * Consumes ONLY redacted_events (allowlist-filtered). Refuses to write
 * if evidence contains raw unredacted 'events' field without redacted_events.
 *
 * Usage:
 *   node tools/k6-proofs/scripts/evidence-writer.mjs \
 *     --input /tmp/r-cd-1-output.txt \
 *     --row R-CD-1 \
 *     --seat ronan-dgx \
 *     --sha <40-char-hex> \
 *     [--manifest tools/k6-proofs/manifests/r-cd-1.json] \
 *     [--scenario r-cd-1.js]
 *
 * Identity binding: when --manifest is supplied, manifest.rowId, the evidence
 * block's own `row`, and --row must agree, and --scenario (when supplied) must
 * match manifest.scenario.file. A run directory that files one row's behavior
 * under another row's name is not evidence.
 *
 * Writes:
 *   PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/
 *     ├── EVIDENCE.md
 *     ├── k6-summary.json
 *     ├── gateway-events.ndjson  (redacted only)
 *     ├── k6-run.log             (sanitized console log)
 *     ├── row-result.json
 *     └── seat-readiness.json  (when --seat-readiness is supplied)
 */

import { copyFileSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { sanitizeEvidenceRecords, sanitizeLog } from './sanitize-k6-artifacts.mjs';
import { validateRcd2AuthoritativeReceipt } from '../lib/r-cd-2-authoritative-receipt.mjs';
import { extractEvidenceData } from '../lib/k6-log-evidence.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for --${key}`);
    out[key] = value;
    i += 1;
  }
  return out;
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function usage() {
  console.error(`Usage: node evidence-writer.mjs --input <k6-output> --row <ROW> --seat <SEAT> --sha <SHA> [--manifest <row-manifest.json>] [--scenario <scenario-file.js>]`);
  process.exit(2);
}

// --- Main ---
const args = parseArgs(process.argv);
if (!args.input || !args.row || !args.seat || !args.sha) usage();

// Validate SHA is 40-char hex
if (!/^[0-9a-f]{40}$/.test(args.sha)) {
  console.error(`ERROR: --sha must be a 40-character hex string (got: "${args.sha}")`);
  process.exit(1);
}

const manifest = args.manifest ? JSON.parse(readFileSync(args.manifest, 'utf-8')) : null;
if (manifest && (manifest.review?.foldRequiresReview !== true || manifest.liveRunSafety?.foldRequiresReview === false)) {
  console.error('ERROR: manifest must keep foldRequiresReview=true for candidate evidence');
  process.exit(1);
}

// --- IDENTITY BINDING ---
// A run directory is named by (row, seat, sha). If the manifest, the scenario
// and the evidence block do not all agree on the row, the artifact would file
// one row's behavior under another row's name.
if (manifest && manifest.rowId !== args.row) {
  console.error(`ERROR: manifest rowId "${manifest.rowId}" does not match --row "${args.row}"`);
  process.exit(1);
}
if (args.scenario && manifest?.scenario?.file && manifest.scenario.file !== args.scenario) {
  console.error(
    `ERROR: --scenario "${args.scenario}" does not match manifest scenario.file "${manifest.scenario.file}"`,
  );
  process.exit(1);
}

const raw = readFileSync(args.input, 'utf-8');

// Extract the evidence JSON block from k6 console output.
//
// The workflow feeds this writer the RAW k6 log (`/tmp/k6-out/run.txt`), which
// is logrus-framed:
//   time="..." level=info msg="--- R-CD-IN-1 EVIDENCE SUMMARY ---" source=console
//   time="..." level=info msg="{\n  \"row\": \"R-CD-IN-1\", ...}" source=console
//   time="..." level=info msg="--- END EVIDENCE ---" source=console
//
// Matching bare marker lines against that text finds nothing, and the writer
// exits before identity binding, receipt-map recomputation, liveRunSafety
// capture and sanitized-log writing. The shared decode-aware extractor consumes
// production framing, bare single-line fixtures and pretty-printed bare blocks
// alike, so one post-processor can consume candidate output from every scenario.
const extracted = extractEvidenceData(raw);
if (extracted.records.length === 0) {
  if (extracted.markerSeen) {
    console.error('ERROR: evidence marker found in k6 output but no evidence record parsed');
    console.error('The block between the markers must be a single JSON object.');
  } else {
    console.error('ERROR: Could not find evidence summary block in k6 output');
    console.error('Supported markers (bare or k6 logrus-framed msg="..." lines):');
    console.error('  --- <ROW> EVIDENCE SUMMARY --- ... --- END EVIDENCE ---');
    console.error('  === K6-PROOF-EVIDENCE === ... --- END EVIDENCE ---');
    console.error('  === K6-PROOF-EVIDENCE === ... === END K6-PROOF-EVIDENCE ===');
  }
  process.exit(1);
}

// A run log may carry more than one record (e.g. a re-emitted summary). Prefer
// the one that names the row under test; identity binding below rejects any
// other mismatch.
const evidence = extracted.records.find((record) => record.row === args.row)
  || extracted.records[0];

if (evidence.row && evidence.row !== args.row) {
  console.error(`ERROR: evidence block row "${evidence.row}" does not match --row "${args.row}"`);
  process.exit(1);
}

let authoritativeReceipt = null;
if (args.row === 'R-CD-2') {
  if (!args['authoritative-receipt']) {
    throw new Error('R-CD-2 requires --authoritative-receipt; generic evidence cannot promote this row');
  }
  authoritativeReceipt = JSON.parse(readFileSync(args['authoritative-receipt'], 'utf8'));
  const validation = validateRcd2AuthoritativeReceipt(authoritativeReceipt, process.env.OPENCLAW_GATEWAY_TOKEN);
  if (!validation.valid) throw new Error(`R-CD-2 authoritative receipt rejected: ${validation.reason}`);
}

// --- REDACTION BOUNDARY ---
// Refuse to write if evidence has raw 'events' but no 'redacted_events'
if (evidence.events && !evidence.redacted_events) {
  console.error('ERROR: Evidence contains raw unredacted "events" field.');
  console.error('Public artifacts require "redacted_events" (allowlist-filtered).');
  console.error('Fix the scenario to use redactEvent() and store in redacted_events.');
  process.exit(1);
}

const events = evidence.redacted_events || [];
const { sanitized: [summary], orderedTokens } = sanitizeEvidenceRecords([evidence]);
const { sanitized: safeEvents } = sanitizeEvidenceRecords(events, orderedTokens);

// Validate all public-safe data and resolve the verdict BEFORE creating a run
// directory. A rejected scenario-reported PASS must leave no uploadable
// success-shaped summary behind.
const runId = `k6-run-${stamp()}`;
const outDir = join('PROOFS', args.sha, args.row, args.seat, runId);

let authoritativeReceiptDigest = null;
if (authoritativeReceipt) {
  const raw = readFileSync(args['authoritative-receipt']);
  authoritativeReceiptDigest = createHash('sha256').update(raw).digest('hex');
}

// The raw k6 console log carries session keys, claim ids, child keys and paths.
// Prepare it through the shared sanitizer now, but do not write it until the
// authoritative verdict validation below has accepted the candidate output.
const publicRunLog = sanitizeLog(raw, [summary], orderedTokens);
for (const [token] of orderedTokens) {
  if (publicRunLog.includes(token)) {
    console.error('ERROR: sanitized k6 run log still contains a sensitive value');
    process.exit(1);
  }
}

// --- VERDICT RESOLUTION ---
//
// Three evidence shapes reach this writer:
//   1. an R-CD-2 authoritative receipt (signed, row-scoped) — highest authority;
//   2. the receipt-map shape (`verdict` + `receipts` + `negative_checks` +
//      `orchestration`) used by the delegate attachment I/O family;
//   3. the legacy flag shape (`tool_accepted` / `task_created` / ...).
//
// Shape 2 must NOT be read with shape 3's rules: a valid PASS-candidate would
// be rewritten to FAIL-candidate because it carries no `tool_accepted` flag.
// When the receipt map is present the writer recomputes the verdict from it
// and from the manifest's requiredReceipts, and refuses to publish a verdict
// stronger than what the receipts support.
function hasReceiptMap(record) {
  return (
    record
    && typeof record.verdict === 'string'
    && record.receipts
    && typeof record.receipts === 'object'
  );
}

function recomputeReceiptMapVerdict(record, manifestDoc) {
  const receipts = record.receipts || {};
  const negatives = record.negative_checks || {};
  const manifestRequired = (manifestDoc?.liveRunSafety?.requiredReceipts || [])
    // `seat-readiness` is produced by the preflight, not by the scenario.
    .filter((name) => name !== 'seat-readiness');
  const declaredRequired = Array.isArray(record.missing_receipts) ? record.missing_receipts : [];
  const missing = [
    ...declaredRequired,
    ...manifestRequired.filter((name) => !receipts[name] && !(name in negatives)),
  ];
  const violated = Object.keys(negatives).filter((name) => negatives[name]?.held !== true);
  const orchestrationRequired = Boolean(record.orchestration?.required);
  const orchestrationObserved = record.orchestration?.observed === true;
  const uniqueMissing = [...new Set(missing)];
  const ok = uniqueMissing.length === 0
    && violated.length === 0
    && (!orchestrationRequired || orchestrationObserved);
  return {
    verdict: ok ? 'PASS-candidate' : 'PARTIAL-candidate',
    missingReceipts: uniqueMissing,
    violatedNegativeChecks: violated,
    orchestrationRequired,
    orchestrationObserved,
    orchestrationReason: record.orchestration?.reason || null,
  };
}

let verdict;
let verdictSource;
let receiptAudit = null;
if (authoritativeReceipt) {
  verdict = authoritativeReceipt.verdict;
  verdictSource = 'r-cd-2-authoritative-receipt';
} else if (hasReceiptMap(evidence)) {
  receiptAudit = recomputeReceiptMapVerdict(evidence, manifest);
  verdict = receiptAudit.verdict;
  verdictSource = 'receipt-map-recomputed';
  if (evidence.verdict === 'PASS-candidate' && verdict !== 'PASS-candidate') {
    console.error(
      `ERROR: scenario reported PASS-candidate but the receipt map does not support it ` +
        `(missing: ${receiptAudit.missingReceipts.join(', ') || 'none'}; ` +
        `violated: ${receiptAudit.violatedNegativeChecks.join(', ') || 'none'}; ` +
        `orchestration observed: ${receiptAudit.orchestrationObserved}).`,
    );
    process.exit(1);
  }
} else {
  verdict = (evidence.tool_accepted || evidence.prompt_sent
    ? (evidence.task_created || evidence.child_spawned ? 'PASS-candidate' : 'PARTIAL-candidate')
    : 'FAIL-candidate');
  verdictSource = 'generic-evidence';
}

// Only an accepted verdict may materialize public candidate artifacts. This is
// deliberately below the unsupported-PASS refusal: the workflow uploads its
// failure path, so a partial directory without row-result.json would otherwise
// look like an accepted PASS to downstream reviewers.
mkdirSync(join(outDir, 'artifacts'), { recursive: true });
if (args['seat-readiness']) {
  copyFileSync(args['seat-readiness'], join(outDir, 'seat-readiness.json'));
}
if (authoritativeReceipt) {
  // Carry the signed authority alongside every public candidate surface so a
  // report/envelope cannot cite an uninspectable generic PASS.
  copyFileSync(args['authoritative-receipt'], join(outDir, 'r-cd-2-authoritative-receipt.json'));
}
writeFileSync(join(outDir, 'k6-summary.json'), JSON.stringify(summary, null, 2) + '\n');
if (safeEvents.length > 0) {
  const ndjson = safeEvents.map((e) => JSON.stringify(e)).join('\n') + '\n';
  writeFileSync(join(outDir, 'gateway-events.ndjson'), ndjson);
}
writeFileSync(join(outDir, 'evidence-redaction.json'), JSON.stringify({
  schema: 'openclaw.k6.public-evidence-redaction.v1',
  generatedAt: new Date().toISOString(),
  removedSensitiveValues: orderedTokens.length,
  records: 1,
}, null, 2) + '\n');
writeFileSync(join(outDir, 'k6-run.log'), publicRunLog);


// Write row-result.json
const result = {
  schema: 'openclaw.k6.proof-row-result.v1',
  runId,
  generatedAt: new Date().toISOString(),
  rowId: args.row,
  candidateSha: args.sha,
  seat: args.seat,
  outcome: verdict,
  verdictSource,
  scenario: manifest?.scenario?.file || args.scenario || null,
  manifest: args.manifest || null,
  scenarioReportedVerdict: hasReceiptMap(evidence) ? evidence.verdict : null,
  ...(receiptAudit ? { receiptAudit } : {}),
  ...(authoritativeReceiptDigest ? { authoritativeReceipt: {
    schema: authoritativeReceipt.schema, validated: true, source: 'r-cd-2-row-scoped-resolver',
    file: 'r-cd-2-authoritative-receipt.json', sha256: authoritativeReceiptDigest,
  } } : {}),
  liveRunSafety: manifest?.liveRunSafety ? {
    classification: manifest.liveRunSafety.classification,
    requiresLiveGatewayToken: Boolean(manifest.liveRunSafety.requiresLiveGatewayToken),
    requiresTargetSessionKey: Boolean(manifest.liveRunSafety.requiresTargetSessionKey),
    requiresCandidateSha: Boolean(manifest.liveRunSafety.requiresCandidateSha),
    requiresExternalAgentOrToolInvocation: Boolean(manifest.liveRunSafety.requiresExternalAgentOrToolInvocation),
    sameSessionConcurrencySafe: Boolean(manifest.liveRunSafety.sameSessionConcurrencySafe),
    expectedArtifactClass: manifest.liveRunSafety.expectedArtifactClass,
    requiredReceipts: manifest.liveRunSafety.requiredReceipts || [],
    foldRequiresReview: manifest.liveRunSafety.foldRequiresReview === true,
  } : null,
  candidateOnly: true,
  foldRequiresReview: true,
};
writeFileSync(join(outDir, 'row-result.json'), JSON.stringify(result, null, 2) + '\n');

// Generate EVIDENCE.md
const md = `# ${args.row} — ${args.seat} — ${verdict}

> Generated by \`tools/k6-proofs/scripts/evidence-writer.mjs\`.
> This is **candidate output**, not a folded proof verdict.
> Human review is required before copying into canonical \`EVIDENCE.md\` or manifests.

## Row

- Row: \`${args.row}\`
- Candidate SHA: \`${args.sha}\`
- Seat: \`${args.seat}\`
- Run ID: \`${runId}\`
- Generated: ${result.generatedAt}

## Candidate outcome

**${verdict}**

- Verdict source: \`${verdictSource}\`
- Scenario: \`${result.scenario || 'not supplied'}\`
- Manifest: \`${args.manifest || 'not supplied to writer'}\`

## Evidence receipts

${receiptAudit ? `| Receipt | Result |
|---------|--------|
${Object.keys(evidence.receipts).map((name) => `| \`${name}\` | ✓ |`).join('\n') || '| _(none fired)_ | ✗ |'}
${receiptAudit.missingReceipts.map((name) => `| \`${name}\` | ✗ missing |`).join('\n')}

| Negative check | Held |
|----------------|------|
${Object.entries(evidence.negative_checks || {}).map(([name, entry]) => `| \`${name}\` | ${entry.held ? '✓' : `✗ — ${entry.violation || 'violated'}`} |`).join('\n') || '| _(none declared)_ | — |'}

- Orchestration precondition: ${receiptAudit.orchestrationRequired ? `\`${evidence.orchestration.required}\`` : 'none'}
- Orchestration observed: ${receiptAudit.orchestrationRequired ? (receiptAudit.orchestrationObserved ? 'yes' : `no — ${receiptAudit.orchestrationReason || 'reason not recorded'}`) : 'n/a'}` : `| Check | Result |
|-------|--------|
| Tool/prompt accepted | ${evidence.tool_accepted || evidence.prompt_sent ? '✓' : '✗'} |
| Task/child created | ${evidence.task_created || evidence.child_spawned ? '✓' : '✗'} |
| Parent return observed | ${evidence.parent_return ? '✓' : '✗'} |
| Safe reason fingerprint | \`${summary.reason_hash || 'N/A'}\` / length \`${summary.reason_length || 'N/A'}\` |
| Manifest loaded | ${evidence.manifest_loaded ? '✓' : '✗ (defaults used)'} |`}

## Artifacts

- \`k6-summary.json\` — structured evidence (no raw events)
- \`gateway-events.ndjson\` — redacted WS frames (${safeEvents.length} captured)
- \`evidence-redaction.json\` — public-safe redaction receipt
- \`row-result.json\` — normalized outcome
- \`k6-run.log\` — sanitized k6 console log (${args.input ? 'written' : 'not available'})
- \`seat-readiness.json\` — public-safe seat/tooling preflight (${args['seat-readiness'] ? 'captured' : 'not supplied to writer'})
- \`artifacts/\` — optional copied receipts (Tempo trace, logs)

## Live-run safety

${manifest?.liveRunSafety ? `- Classification: \`${manifest.liveRunSafety.classification}\`
- Requires live gateway token: ${manifest.liveRunSafety.requiresLiveGatewayToken ? 'yes' : 'no'}
- Requires explicit target session key: ${manifest.liveRunSafety.requiresTargetSessionKey ? 'yes' : 'no'}
- Requires candidate SHA: ${manifest.liveRunSafety.requiresCandidateSha ? 'yes' : 'no'}
- Requires external agent/tool invocation: ${manifest.liveRunSafety.requiresExternalAgentOrToolInvocation ? 'yes' : 'no'}
- Same-session concurrency safe: ${manifest.liveRunSafety.sameSessionConcurrencySafe ? 'yes' : 'no'}
- Expected artifact class: \`${manifest.liveRunSafety.expectedArtifactClass}\`
- Required receipts: ${manifest.liveRunSafety.requiredReceipts.map((r) => `\`${r}\``).join(', ')}
- Fold requires review: ${manifest.liveRunSafety.foldRequiresReview ? 'yes' : 'no'}` : '- No manifest supplied to evidence-writer; reviewer must verify live-run safety from the row manifest.'}

## Redaction boundary

All summary and event fields passed through the shared public-safe artifact
sanitizer. Nonces, session keys, run/idempotency identifiers, task/prompt
bodies, message payloads, and raw captured event containers are removed.

## Review checklist

- [ ] No secrets in any artifact
- [ ] Required receipts present and byte-readable
- [ ] Tempo trace JSON fetched and saved (if trace_id captured)
- [ ] Row semantics match current proof runbook
- [ ] Only then fold into canonical EVIDENCE.md
`;

writeFileSync(join(outDir, 'EVIDENCE.md'), md);

console.log(JSON.stringify({ runDir: outDir, outcome: verdict, rowId: args.row, candidateOnly: true }, null, 2));
