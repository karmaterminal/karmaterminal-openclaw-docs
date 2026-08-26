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
 *     [--manifest tools/k6-proofs/manifests/r-cd-1.json]
 *
 * Writes:
 *   PROOFS/<sha>/<row>/<seat>/k6-run-<timestamp>/
 *     ├── EVIDENCE.md
 *     ├── k6-summary.json
 *     ├── gateway-events.ndjson  (redacted only)
 *     ├── row-result.json
 *     └── seat-readiness.json  (when --seat-readiness is supplied)
 */

import { copyFileSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { sanitizeEvidenceRecords } from './sanitize-k6-artifacts.mjs';
import { validateRcd2AuthoritativeReceipt } from '../lib/r-cd-2-authoritative-receipt.mjs';
import {
  buildTelemetryBackendStatusReceipt,
  validateTelemetryBackendStatusReceipt,
} from '../lib/telemetry-backend-status.js';
import { telemetryPassBlockers, telemetryRebindFrom } from '../lib/telemetry-rebind.js';

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
  console.error(`Usage: node evidence-writer.mjs --input <k6-output> --row <ROW> --seat <SEAT> --sha <SHA> [--manifest <row-manifest.json>]`);
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

const raw = readFileSync(args.input, 'utf-8');

// Extract the evidence JSON block from k6 console output.
//
// Historical scenarios emitted row-scoped banners such as:
//   --- R-CD-2 EVIDENCE SUMMARY ---
//   { ... }
//   --- END EVIDENCE ---
//
// The live R-CD-1/R-CD-TOKEN scenarios emit the generic proof banner:
//   === K6-PROOF-EVIDENCE ===
//   { ... }
//   --- END EVIDENCE ---
//
// Keep the writer tolerant at the scenario↔writer seam: one post-processor
// should be able to consume candidate output from every k6 proof scenario.
const evidencePatterns = [
  /---\s+[^\n]*\bEVIDENCE SUMMARY\b[^\n]*---\s*\n([\s\S]*?)\n---\s+END EVIDENCE\s+---/,
  /===\s+K6-PROOF-EVIDENCE\s+===\s*\n([\s\S]*?)\n---\s+END EVIDENCE\s+---/,
  /===\s+K6-PROOF-EVIDENCE\s+===\s*\n([\s\S]*?)\n===\s+END K6-PROOF-EVIDENCE\s+===/,
];

const evidenceMatch = evidencePatterns.map((pattern) => raw.match(pattern)).find(Boolean);
if (!evidenceMatch) {
  console.error('ERROR: Could not find evidence summary block in k6 output');
  console.error('Supported markers:');
  console.error('  --- <ROW> EVIDENCE SUMMARY --- ... --- END EVIDENCE ---');
  console.error('  === K6-PROOF-EVIDENCE === ... --- END EVIDENCE ---');
  console.error('  === K6-PROOF-EVIDENCE === ... === END K6-PROOF-EVIDENCE ===');
  process.exit(1);
}

let evidence;
try {
  evidence = JSON.parse(evidenceMatch[1]);
} catch (err) {
  console.error(`ERROR: Evidence block was found but did not parse as JSON: ${err.message}`);
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

// Build output directory
const runId = `k6-run-${stamp()}`;
const outDir = join('PROOFS', args.sha, args.row, args.seat, runId);
mkdirSync(join(outDir, 'artifacts'), { recursive: true });

let authoritativeReceiptDigest = null;
if (authoritativeReceipt) {
  const raw = readFileSync(args['authoritative-receipt']);
  authoritativeReceiptDigest = createHash('sha256').update(raw).digest('hex');
  writeFileSync(join(outDir, 'r-cd-2-authoritative-receipt.json'), raw);
}

if (args['seat-readiness']) {
  copyFileSync(args['seat-readiness'], join(outDir, 'seat-readiness.json'));
}
if (authoritativeReceipt) {
  // Carry the signed authority alongside every public candidate surface so a
  // report/envelope cannot cite an uninspectable generic PASS.
  copyFileSync(args['authoritative-receipt'], join(outDir, 'r-cd-2-authoritative-receipt.json'));
}

// Write k6-summary.json through the same public-safe boundary as run-proofs.sh.
writeFileSync(join(outDir, 'k6-summary.json'), JSON.stringify(summary, null, 2) + '\n');

// Write gateway-events.ndjson (redacted only)
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

// Determine verdict
let verdict = authoritativeReceipt ? authoritativeReceipt.verdict : (evidence.tool_accepted || evidence.prompt_sent
  ? (evidence.task_created || evidence.child_spawned ? 'PASS-candidate' : 'PARTIAL-candidate')
  : 'FAIL-candidate');
let backendStatus = null;
let telemetryRebind = null;
let telemetryBlockers = [];
if (manifest?.telemetryContract) {
  const backendContract = manifest.telemetryContract.backendUnavailable;
  if (args['backend-status']) {
    backendStatus = JSON.parse(readFileSync(args['backend-status'], 'utf8'));
    const validation = validateTelemetryBackendStatusReceipt(backendStatus, {
      rowId: args.row,
      requiredCompletenessKeys:
        manifest.telemetryContract.backendUnavailable.requiredCompletenessKeys,
      rebindKeys: manifest.telemetryContract.backendUnavailable.rebindKeys,
    });
    if (!validation.valid) {
      throw new Error(
        `backend-status receipt rejected: ${validation.failures.join('; ')}`,
      );
    }
  } else {
    backendStatus = buildTelemetryBackendStatusReceipt({
      rowId: args.row,
      candidateSha: args.sha,
      seat: args.seat,
      proofRunId: runId,
      interactions: [],
      requiredCompletenessKeys: backendContract.requiredCompletenessKeys,
      rebindKeys: backendContract.rebindKeys,
      rebindValues: {
        candidate_sha: args.sha,
        row_id: args.row,
        seat: args.seat,
        run_id: runId,
        proof_run_id: runId,
      },
    });
  }
  const plannedArtifacts = new Set([
    'EVIDENCE.md',
    'row-result.json',
    'k6-summary.json',
    'backend-status.json',
    ...(authoritativeReceipt ? ['r-cd-2-authoritative-receipt.json'] : []),
    ...(args['seat-readiness'] ? ['seat-readiness.json'] : []),
    ...(safeEvents.length > 0 ? ['gateway-events.ndjson'] : []),
  ]);
  telemetryRebind = telemetryRebindFrom({
    manifest,
    receiptStatuses: (manifest.expectedReceipts || []).map((receipt) => ({
      name: receipt.name,
      status: 'unknown',
    })),
    backendStatus,
    artifactStatuses:
      (manifest.telemetryContract.artifact?.requiredFiles || []).map((name) => ({
        name,
        status: plannedArtifacts.has(name) ? 'present' : 'missing',
      })),
  });
  telemetryBlockers = verdict === 'PASS-candidate'
    ? telemetryPassBlockers(telemetryRebind)
    : [];
  if (telemetryBlockers.length > 0) verdict = 'PARTIAL-candidate';
}

// Write row-result.json
const result = {
  schema: 'openclaw.k6.proof-row-result.v1',
  runId,
  generatedAt: new Date().toISOString(),
  rowId: args.row,
  candidateSha: args.sha,
  seat: args.seat,
  outcome: verdict,
  verdictSource: `${authoritativeReceipt
    ? 'r-cd-2-authoritative-receipt'
    : 'generic-evidence'}${telemetryBlockers.length
    ? '+telemetry-disposition-policy'
    : ''}`,
  ...(authoritativeReceiptDigest ? { authoritativeReceipt: {
    schema: authoritativeReceipt.schema, validated: true, source: 'r-cd-2-row-scoped-resolver',
    file: 'r-cd-2-authoritative-receipt.json', sha256: authoritativeReceiptDigest,
  } } : {}),
  ...(telemetryRebind ? { telemetryRebind } : {}),
  ...(backendStatus ? {
    observability: {
      backendStatus: 'backend-status.json',
      backendDisposition: backendStatus.status,
      backendComplete: backendStatus.complete,
    },
  } : {}),
  ...(telemetryBlockers.length > 0 ? {
    failureClass: telemetryBlockers[0].failureClass,
    reason: `withheld from PASS-candidate: ${
      telemetryBlockers.map((entry) => entry.reason).join('; ')
    }`,
  } : {}),
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
if (backendStatus) {
  writeFileSync(
    join(outDir, 'backend-status.json'),
    `${JSON.stringify(backendStatus, null, 2)}\n`,
  );
}

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

## Evidence receipts

| Check | Result |
|-------|--------|
| Tool/prompt accepted | ${evidence.tool_accepted || evidence.prompt_sent ? '✓' : '✗'} |
| Task/child created | ${evidence.task_created || evidence.child_spawned ? '✓' : '✗'} |
| Parent return observed | ${evidence.parent_return ? '✓' : '✗'} |
| Safe reason fingerprint | \`${summary.reason_hash || 'N/A'}\` / length \`${summary.reason_length || 'N/A'}\` |
| Manifest loaded | ${evidence.manifest_loaded ? '✓' : '✗ (defaults used)'} |

## Artifacts

- \`k6-summary.json\` — structured evidence (no raw events)
- \`gateway-events.ndjson\` — redacted WS frames (${safeEvents.length} captured)
- \`evidence-redaction.json\` — public-safe redaction receipt
- \`row-result.json\` — normalized outcome
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
