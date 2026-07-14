#!/usr/bin/env node
/**
 * Validate one candidate run directory and emit its public-safe routing
 * envelope. This is deliberately a candidate-only boundary: it reads a row
 * manifest plus one candidate directory and can write only inside that
 * candidate directory. It never reads or changes canonical PROOFS manifests.
 */
import { readFile, writeFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

const SHA = /^[0-9a-f]{40}$/;
const OUTCOME = new Set(['PASS-candidate', 'HONEST-LIMIT-candidate', 'PARTIAL-candidate', 'FAIL-candidate', 'construct-only']);

function usage() {
  console.error('Usage: node validate-candidate-run-result.mjs --manifest <row-manifest.json> --candidate-dir <run-dir> --docs-ref <40-char-sha> [--out <candidate-run-result.json>] [--json]');
}

function parseArgs(argv) {
  const args = { json: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') { args.json = true; continue; }
    if (arg === '--help' || arg === '-h') { args.help = true; continue; }
    if (!['--manifest', '--candidate-dir', '--docs-ref', '--out'].includes(arg)) throw new Error(`unexpected argument: ${arg}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    args[arg.slice(2).replaceAll('-', '')] = value;
    i += 1;
  }
  return args;
}

async function readJson(file, label) {
  let raw;
  try { raw = await readFile(file, 'utf8'); }
  catch (error) { throw new Error(`${label} missing or unreadable: ${error.message}`); }
  try { return JSON.parse(raw); }
  catch (error) { throw new Error(`${label} is malformed JSON: ${error.message}`); }
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function requireSha(value, label) {
  if (!SHA.test(value || '')) throw new Error(`${label} must be a 40-character lowercase SHA`);
  return value;
}

function safeRelative(value, label) {
  if (value == null) return null;
  if (typeof value !== 'string' || !value || path.isAbsolute(value) || value.split(/[\\/]+/).some((part) => part === '..')) {
    throw new Error(`${label} must be a safe artifact-relative path`);
  }
  return value.replaceAll('\\', '/');
}

function same(value, expected, label) {
  if (value !== expected) throw new Error(`${label} mismatch: ${JSON.stringify(value)} != ${JSON.stringify(expected)}`);
}

function scenarioName(manifest) {
  return manifest?.scenario?.name || manifest?.scenario?.file?.replace(/\.js$/, '') || null;
}

function manifestCandidateSha(manifest) {
  const value = manifest?.candidateSha;
  return SHA.test(value || '') ? value : null;
}

async function listSafeArtifacts(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const allowed = new Set([
    'row-manifest.json', 'runner-metadata.json', 'run-result.json',
    'candidate-run-result.json', 'seat-readiness.json', 'evidence.jsonl',
    'evidence-lines.log', 'evidence-redaction.json', 'gateway-journal.log',
    'gateway-journal-capture.json', 'gateway-journal-redaction.json',
  ]);
  return entries
    .filter((entry) => entry.isFile() && (allowed.has(entry.name) || /(?:^|-)summary\.json$/i.test(entry.name)))
    .map((entry) => entry.name)
    .sort();
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { usage(); return; }
  if (!args.manifest || !args.candidatedir || !args.docsref) { usage(); throw new Error('manifest, candidate-dir, and docs-ref are required'); }
  const docsRef = requireSha(args.docsref, 'docs-ref');
  const manifestPath = path.resolve(args.manifest);
  const candidateDir = await realpath(args.candidatedir).catch(() => { throw new Error(`candidate directory does not exist: ${args.candidatedir}`); });
  const manifest = await readJson(manifestPath, 'manifest');
  const metadata = await readJson(path.join(candidateDir, 'runner-metadata.json'), 'runner metadata');
  const runResult = await readJson(path.join(candidateDir, 'run-result.json'), 'run result');

  same(manifest.schema, 'openclaw.k6.proof-row-manifest.v1', 'manifest schema');
  if (manifest.review?.candidateOnly !== true || manifest.review?.foldRequiresReview !== true) throw new Error('manifest must remain candidateOnly and require human fold review');
  if (runResult.candidateOnly !== true || runResult.foldRequiresReview !== true) throw new Error('run result must remain candidateOnly and require human fold review');
  const rowId = requireString(metadata.row, 'runner metadata row');
  const candidateSha = requireSha(metadata.candidateSha, 'runner metadata candidateSha');
  const seat = requireString(metadata.seat, 'runner metadata seat');
  const scenario = requireString(metadata.scenario, 'runner metadata scenario').replace(/\.js$/, '');
  same(rowId, manifest.rowId, 'row ID');
  same(scenario, scenarioName(manifest), 'scenario');
  const declaredSha = manifestCandidateSha(manifest);
  if (declaredSha) same(candidateSha, declaredSha, 'candidate SHA');

  const verdict = runResult.verdict;
  if (!OUTCOME.has(verdict)) throw new Error('run result verdict must be an explicit candidate outcome');
  const expectedArtifactClass = manifest.liveRunSafety?.expectedArtifactClass;
  if (expectedArtifactClass === 'construct-only' && verdict !== 'construct-only') throw new Error('construct-only manifest cannot emit behavioral candidate evidence');
  if (runResult.effectiveExitCode !== 0) throw new Error('candidate run is incomplete: effective exit code is non-zero');
  const review = runResult.review;
  if (review?.status !== 'ready-for-human-review' || !Array.isArray(review.pendingReceipts) || review.pendingReceipts.length !== 0) {
    throw new Error('candidate run is review-incomplete: resolve or explicitly classify pending receipts first');
  }

  const observability = runResult.observability || {};
  const artifacts = {
    manifest: 'row-manifest.json',
    runnerMetadata: 'runner-metadata.json',
    runResult: 'run-result.json',
    files: await listSafeArtifacts(candidateDir),
    tempoTraceJson: safeRelative(observability.tempoTraceJson, 'tempo trace artifact'),
    correlationReceipt: safeRelative(observability.correlationReceipt, 'correlation receipt artifact'),
  };
  const envelope = {
    schema: 'openclaw.k6.candidate-run-result.v1',
    candidateOnly: true,
    foldRequiresReview: true,
    canonicalFoldForbidden: true,
    candidate: { sha: candidateSha, docsRef },
    run: {
      id: path.basename(candidateDir),
      rowId,
      seat,
      scenario,
      executionKind: 'row-list-runner',
    },
    result: {
      outcome: verdict,
      outcomeSource: requireString(runResult.verdictSource, 'run result verdictSource'),
      effectiveExitCode: runResult.effectiveExitCode,
      behaviorProof: false,
    },
    observability: {
      traceStatus: requireString(observability.traceStatus, 'observability traceStatus'),
      traceCaptured: Boolean(observability.traceId),
      correlationReceiptPresent: Boolean(observability.correlationReceipt),
    },
    review: { status: review.status, pendingReceipts: [], complete: true },
    artifacts,
  };

  if (args.out) {
    const outPath = path.resolve(args.out);
    if (path.dirname(outPath) !== candidateDir || path.basename(outPath) !== 'candidate-run-result.json') {
      throw new Error('output must be candidate-run-result.json directly inside the candidate directory');
    }
    await writeFile(outPath, `${JSON.stringify(envelope, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
