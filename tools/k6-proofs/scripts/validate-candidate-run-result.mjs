#!/usr/bin/env node
/**
 * Validate one candidate run directory and emit its public-safe routing
 * envelope. This is deliberately a candidate-only boundary: it reads a row
 * manifest plus one candidate directory and can write only inside that
 * candidate directory. It never reads or changes canonical PROOFS manifests.
 */
import { readFile, writeFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateRcd2AuthoritativeReceipt } from '../lib/r-cd-2-authoritative-receipt.mjs';
import { validateRcdTokenAuthoritativeReceipt } from '../lib/r-cd-token-authoritative-receipt.mjs';
import { COPIED_MANIFEST, COPIED_SCENARIO, isSafeCandidateArtifact } from './candidate-run-result-contract.mjs';

const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const HARNESS_MANIFEST_PATH = /^tools\/k6-proofs\/manifests\/[A-Za-z0-9._-]+\.json$/;
const HARNESS_SCENARIO_PATH = /^tools\/k6-proofs\/scenarios\/[A-Za-z0-9._-]+\.js$/;
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

function requireDigest(value, label) {
  if (!DIGEST.test(value || '')) throw new Error(`${label} must be a 64-character lowercase sha256 digest`);
  return value;
}

async function fileDigest(file, label) {
  let raw;
  try { raw = await readFile(file); }
  catch (error) { throw new Error(`${label} missing or unreadable: ${error.message}`); }
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Bind the candidate directory to one immutable docs/harness commit (#496).
 *
 * The runner freezes the approved docs ref before the first row fires and copies
 * the exact manifest and scenario bytes it used into the candidate directory.
 * Metadata that omits the ref or either digest, or whose digests disagree with
 * the copied source, cannot produce an envelope.
 */
async function harnessIdentity(metadata, candidateDir, docsRef, manifestPath) {
  const metadataDocsRef = requireSha(metadata.docsRef, 'runner metadata docsRef');
  same(metadataDocsRef, docsRef, 'docs ref');
  const repository = requireString(metadata.repository, 'runner metadata repository');
  if (!REPOSITORY.test(repository)) throw new Error('runner metadata repository must be a safe <owner>/<repo> identity');
  const harnessManifestPath = requireString(metadata.manifestPath, 'runner metadata manifestPath');
  if (!HARNESS_MANIFEST_PATH.test(harnessManifestPath)) throw new Error('runner metadata manifestPath must be a tools/k6-proofs/manifests/*.json harness path');
  const harnessScenarioPath = requireString(metadata.scenarioPath, 'runner metadata scenarioPath');
  if (!HARNESS_SCENARIO_PATH.test(harnessScenarioPath)) throw new Error('runner metadata scenarioPath must be a tools/k6-proofs/scenarios/*.js harness path');
  const manifestSha256 = requireDigest(metadata.manifestSha256, 'runner metadata manifestSha256');
  const scenarioSha256 = requireDigest(metadata.scenarioSha256, 'runner metadata scenarioSha256');

  const copiedManifestDigest = await fileDigest(path.join(candidateDir, COPIED_MANIFEST), 'copied row manifest');
  if (copiedManifestDigest !== manifestSha256) {
    throw new Error(`copied row manifest digest mismatch: ${copiedManifestDigest} != ${manifestSha256}`);
  }
  const copiedScenarioDigest = await fileDigest(path.join(candidateDir, COPIED_SCENARIO), 'copied row scenario');
  if (copiedScenarioDigest !== scenarioSha256) {
    throw new Error(`copied row scenario digest mismatch: ${copiedScenarioDigest} != ${scenarioSha256}`);
  }
  // The semantic manifest checks below must describe the same bytes the run
  // captured, not a different manifest handed in on the command line.
  const suppliedManifestDigest = await fileDigest(manifestPath, 'supplied manifest');
  if (suppliedManifestDigest !== manifestSha256) {
    throw new Error('supplied manifest is not the manifest captured for this run: digest mismatch');
  }

  return {
    docsRef: metadataDocsRef,
    repository,
    manifestPath: harnessManifestPath,
    manifestSha256,
    scenarioPath: harnessScenarioPath,
    scenarioSha256,
    manifestArtifact: COPIED_MANIFEST,
    scenarioArtifact: COPIED_SCENARIO,
  };
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

function hasVerifiedRrc2Outcome(rowId, verdict, evidence) {
  if (rowId !== 'R-RC-2') return verdict !== 'HONEST-LIMIT-candidate';
  if (verdict === 'HONEST-LIMIT-candidate') return (
    evidence?.row === 'R-RC-2' &&
    evidence.parent_dispatch_accepted === true &&
    evidence.delegate_requested === true &&
    evidence.child_session_observed === true &&
    evidence.delegate_child_report_observed === true &&
    evidence.child_reported_context_threshold === true &&
    evidence.request_compaction_tool_result_observed === true &&
    evidence.request_compaction_receipt_role === 'toolResult' &&
    evidence.request_compaction_receipt_tool_name === 'request_compaction' &&
    evidence.request_compaction_receipt_status === 'rejected' &&
    evidence.request_compaction_invocation_bound === true &&
    evidence.request_compaction_rejected_context_threshold === true &&
    evidence.guard === 'context_threshold'
  );
  if (verdict === 'PASS-candidate') return (
    evidence?.row === 'R-RC-2' &&
    evidence.parent_dispatch_accepted === true &&
    evidence.delegate_requested === true &&
    evidence.child_session_observed === true &&
    evidence.delegate_child_report_observed === true &&
    evidence.post_compaction_path_observed === true &&
    evidence.request_compaction_tool_result_observed === true &&
    evidence.request_compaction_receipt_role === 'toolResult' &&
    evidence.request_compaction_receipt_tool_name === 'request_compaction' &&
    evidence.request_compaction_receipt_status === 'accepted' &&
    evidence.request_compaction_invocation_bound === true &&
    evidence.request_compaction_accepted === true
  );
  return true;
}

function authoritativeReceiptContract(rowId) {
  if (rowId === 'R-CD-2') {
    return {
      file: 'r-cd-2-authoritative-receipt.json',
      verdictSource: 'r-cd-2-authoritative-receipt',
      validate: validateRcd2AuthoritativeReceipt,
    };
  }
  if (rowId === 'R-CD-TOKEN') {
    return {
      file: 'r-cd-token-authoritative-receipt.json',
      verdictSource: 'r-cd-token-authoritative-receipt',
      validate: validateRcdTokenAuthoritativeReceipt,
    };
  }
  return null;
}

async function listSafeArtifacts(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && isSafeCandidateArtifact(entry.name))
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
  const harness = await harnessIdentity(metadata, candidateDir, docsRef, manifestPath);
  same(rowId, manifest.rowId, 'row ID');
  same(scenario, scenarioName(manifest), 'scenario');
  const declaredSha = manifestCandidateSha(manifest);
  if (declaredSha) same(candidateSha, declaredSha, 'candidate SHA');

  const verdict = runResult.verdict;
  if (!OUTCOME.has(verdict)) throw new Error('run result verdict must be an explicit candidate outcome');
  if (!hasVerifiedRrc2Outcome(rowId, verdict, runResult.evidence)) {
    throw new Error('candidate run result is incomplete or inconsistent: R-RC-2 PASS/HONEST-LIMIT requires the nonce-bound structured request_compaction receipt and matching child return');
  }
  const expectedArtifactClass = manifest.liveRunSafety?.expectedArtifactClass;
  if (expectedArtifactClass === 'construct-only' && verdict !== 'construct-only') throw new Error('construct-only manifest cannot emit behavioral candidate evidence');
  if (runResult.effectiveExitCode !== 0) throw new Error('candidate run is incomplete: effective exit code is non-zero');
  const review = runResult.review;
  if (review?.status !== 'ready-for-human-review' || !Array.isArray(review.pendingReceipts) || review.pendingReceipts.length !== 0) {
    throw new Error('candidate run is review-incomplete: resolve or explicitly classify pending receipts first');
  }

  const observability = runResult.observability || {};
  let authoritativeReceipt = null;
  const authoritative = authoritativeReceiptContract(rowId);
  if (authoritative) {
    const declared = runResult.authoritativeReceipt;
    if (runResult.verdictSource !== authoritative.verdictSource || declared?.file !== authoritative.file || !/^[a-f0-9]{64}$/iu.test(declared?.sha256 || '')) {
      throw new Error(`${rowId} candidate requires a declared authoritative receipt digest`);
    }
    const raw = await readFile(path.join(candidateDir, declared.file));
    if (createHash('sha256').update(raw).digest('hex') !== declared.sha256) throw new Error(`${rowId} authoritative receipt digest mismatch`);
    authoritativeReceipt = JSON.parse(raw);
    const integrity = authoritative.validate(authoritativeReceipt, process.env.OPENCLAW_GATEWAY_TOKEN);
    if (!integrity.valid || integrity.verdict !== runResult.verdict) throw new Error(`${rowId} authoritative receipt invalid: ${integrity.reason || 'verdict mismatch'}`);
    if (rowId === 'R-CD-TOKEN' && (
      authoritativeReceipt.binding?.candidateSha !== candidateSha ||
      authoritativeReceipt.binding?.runtimeBuildSha !== requireSha(metadata.runtimeBuildSha, 'runner metadata runtimeBuildSha') ||
      authoritativeReceipt.binding.runtimeBuildSha !== candidateSha
    )) throw new Error('R-CD-TOKEN authoritative receipt build identity mismatch');
  }
  const artifacts = {
    manifest: COPIED_MANIFEST,
    scenario: COPIED_SCENARIO,
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
    harness,
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
    ...(authoritativeReceipt ? { authoritativeReceipt: { file: authoritative.file, sha256: runResult.authoritativeReceipt.sha256 } } : {}),
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
