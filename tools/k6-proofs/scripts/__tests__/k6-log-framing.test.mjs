import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { extractEvidenceData } from '../../lib/k6-log-evidence.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const k6Root = path.resolve(here, '../..');
const repoRoot = path.resolve(k6Root, '../..');
const writerPath = path.join(k6Root, 'scripts/evidence-writer.mjs');
const sanitizerPath = path.join(k6Root, 'scripts/sanitize-k6-artifacts.mjs');
const manifestsDir = path.join(k6Root, 'manifests');
const CANDIDATE_SHA = '374ad60c6d34d3c710ddab3a13ce2189e1fd09fb';

// --- production framing ------------------------------------------------------
//
// k6 never prints console.log output verbatim. Each call becomes one logrus
// record and a multi-line JSON payload is escaped into a single `msg="..."`
// value. Every fixture in this file is built through this helper so the tests
// exercise the framing the CI workflow actually feeds the consumers.
function k6Line(message, level = 'info') {
  return `time="2026-07-30T20:15:52Z" level=${level} msg=${JSON.stringify(message)} source=console`;
}

const NONCE = 'R-CD-IN-1-1785640552000-canary';
const SESSION_KEY = 'agent:main:p86';
const CHILD_SESSION = `agent:main:r-cd-in-1-${NONCE}`;

function inEvidence(overrides = {}) {
  return {
    row: 'R-CD-IN-1',
    issue: 491,
    manifest_loaded: true,
    nonce: NONCE,
    sessionKey: SESSION_KEY,
    child_session: CHILD_SESSION,
    mount_path: 'workspace/attachments/p86-canary.txt',
    content_receipt: { bytes: 42, sha256_prefix: 'ab12cd34ef56' },
    receipts: Object.fromEntries(
      [
        'tool-invoke-accepted',
        'typed-tool-record-observed',
        'input-snapshot-staged',
        'child-session-bound',
        'child-mount-provenance',
        'child-bytes-bound-to-canary',
      ].map((name) => [name, { observed: true, at_ms: 1 }]),
    ),
    negative_checks: {
      'no-raw-attachment-bytes-on-the-wire': { held: true },
      'no-absolute-path-mount': { held: true },
      'child-bytes-match-the-known-canary': { held: true },
    },
    orchestration: { required: null, observed: false, reason: null },
    missing_receipts: [],
    violated_negative_checks: [],
    redacted_events: [{ ts: 1, kind: 'event', event: 'session.updated', data: { ok: true } }],
    verdict: 'PASS-candidate',
    ...overrides,
  };
}

/** The exact three-call shape `logEvidence()` emits, as k6 frames it. */
function productionRunLog(evidence) {
  return [
    k6Line(`starting proof row ${evidence.row} against session ${SESSION_KEY}`),
    k6Line(`[k6-proof-harness] dispatch nonce ${NONCE}`),
    k6Line(`\n--- ${evidence.row} EVIDENCE SUMMARY ---`),
    k6Line(JSON.stringify(evidence, null, 2)),
    k6Line('--- END EVIDENCE ---'),
    k6Line(`\n[${evidence.row}] VERDICT: ${evidence.verdict}`),
    '',
  ].join('\n');
}

test('extractEvidenceData parses the logrus framing k6 actually emits', () => {
  const evidence = inEvidence();
  const { records, markerSeen } = extractEvidenceData(productionRunLog(evidence));
  assert.equal(markerSeen, true);
  assert.equal(records.length, 1);
  assert.equal(records[0].row, 'R-CD-IN-1');
  assert.equal(records[0].verdict, 'PASS-candidate');
  assert.deepEqual(Object.keys(records[0].receipts).length, 6);
});

test('extractEvidenceData still parses bare and pretty-printed fixtures', () => {
  const evidence = inEvidence();
  const bareSingleLine = `--- R-CD-IN-1 EVIDENCE SUMMARY ---\n${JSON.stringify(evidence)}\n--- END EVIDENCE ---\n`;
  const barePretty = `=== K6-PROOF-EVIDENCE ===\n${JSON.stringify(evidence, null, 2)}\n=== END K6-PROOF-EVIDENCE ===\n`;
  for (const fixture of [bareSingleLine, barePretty]) {
    const { records, markerSeen } = extractEvidenceData(fixture);
    assert.equal(markerSeen, true);
    assert.equal(records.length, 1, 'bare fixtures must keep working');
    assert.equal(records[0].row, 'R-CD-IN-1');
  }
});

test('extractEvidenceData reports markers with zero records instead of silent success', () => {
  const truncated = [
    k6Line('\n--- R-CD-IN-1 EVIDENCE SUMMARY ---'),
    k6Line('{ "row": "R-CD-IN-1", "receipts":'),
    '',
  ].join('\n');
  const { records, markerSeen } = extractEvidenceData(truncated);
  assert.equal(markerSeen, true);
  assert.equal(records.length, 0);
});

// --- sanitizer: log-only mode over production framing -------------------------

async function runSanitizerLogOnly(logText) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'p86-sanitize-'));
  const input = path.join(dir, 'run.txt');
  await writeFile(input, logText);
  const run = spawnSync(
    process.execPath,
    [
      sanitizerPath,
      '--log-input', input,
      '--log-out', path.join(dir, 'run.public.txt'),
      '--receipt-out', path.join(dir, 'run-log-redaction.json'),
    ],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, OPENCLAW_SESSION_KEY: SESSION_KEY } },
  );
  return { dir, run };
}

test('log-only sanitizer parses real k6 framing and scrubs its derived tokens', async () => {
  const { dir, run } = await runSanitizerLogOnly(productionRunLog(inEvidence()));
  try {
    assert.equal(run.status, 0, run.stderr);
    const stdout = JSON.parse(run.stdout);
    assert.equal(stdout.evidenceBlocks, 1, 'production framing must not parse as zero records');
    assert.ok(stdout.removedSensitiveValues > 0, 'tokens must be derived from the parsed record');

    const publicLog = await readFile(path.join(dir, 'run.public.txt'), 'utf8');
    assert.match(publicLog, /PUBLIC_EVIDENCE/, 'the evidence block is re-emitted from its sanitized parse');
    assert.doesNotMatch(publicLog, new RegExp(NONCE), 'the nonce must not survive into the public log');
    assert.doesNotMatch(publicLog, new RegExp(CHILD_SESSION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(!publicLog.includes(SESSION_KEY), 'the target session key must not survive');
    assert.ok(
      !/msg="\{/.test(publicLog),
      'the raw framed evidence payload line must be suppressed, not passed through',
    );
    assert.equal(
      publicLog.split('\n').filter((line) => line.startsWith('PUBLIC_EVIDENCE')).length,
      1,
      'exactly one sanitized record replaces the block',
    );

    const receipt = JSON.parse(await readFile(path.join(dir, 'run-log-redaction.json'), 'utf8'));
    assert.equal(receipt.evidenceBlocks, 1);
    assert.equal(receipt.evidenceMarkersSeen, true);
    assert.ok(receipt.removedSensitiveValues > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('log-only sanitizer fails closed on evidence markers with zero parsed records', async () => {
  const broken = [
    k6Line(`starting proof row against session ${SESSION_KEY}`),
    k6Line('\n--- R-CD-IN-1 EVIDENCE SUMMARY ---'),
    k6Line(`{ "row": "R-CD-IN-1", "nonce": "${NONCE}",`),
    k6Line('--- END EVIDENCE ---'),
    '',
  ].join('\n');
  const { dir, run } = await runSanitizerLogOnly(broken);
  try {
    assert.equal(run.status, 1, 'an unparseable evidence block must not be attested as clean');
    assert.match(run.stderr, /no evidence record parsed/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('log-only sanitizer still handles a log with no evidence markers at all', async () => {
  const { dir, run } = await runSanitizerLogOnly(
    [k6Line('== dry run: no scenario execution, no live session contact =='), ''].join('\n'),
  );
  try {
    assert.equal(run.status, 0, run.stderr);
    const stdout = JSON.parse(run.stdout);
    assert.equal(stdout.evidenceMarkersSeen, false);
    assert.equal(stdout.evidenceBlocks, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('log-only sanitizer suppresses the tail of a pretty-printed bare block', async () => {
  const evidence = inEvidence();
  const bare = [
    `some harness line for session ${SESSION_KEY}`,
    '=== K6-PROOF-EVIDENCE ===',
    JSON.stringify(evidence, null, 2),
    '=== END K6-PROOF-EVIDENCE ===',
    '',
  ].join('\n');
  const { dir, run } = await runSanitizerLogOnly(bare);
  try {
    assert.equal(run.status, 0, run.stderr);
    const publicLog = await readFile(path.join(dir, 'run.public.txt'), 'utf8');
    assert.match(publicLog, /PUBLIC_EVIDENCE/);
    assert.ok(
      !/^\s+"mount_path"/m.test(publicLog),
      'no line of the raw pretty-printed block may pass through as ordinary log text',
    );
    assert.ok(!publicLog.includes(NONCE));
    assert.ok(!publicLog.includes(CHILD_SESSION));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- evidence-writer over the workflow's raw k6 log ---------------------------

async function runWriterOnLog(logText, extraArgs) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'p86-writer-framing-'));
  const input = path.join(dir, 'run.txt');
  await writeFile(input, logText);
  const run = spawnSync(
    process.execPath,
    [
      writerPath,
      '--input', input,
      '--row', 'R-CD-IN-1',
      '--seat', 'rune-rog-ally',
      '--sha', CANDIDATE_SHA,
      ...extraArgs,
    ],
    { cwd: dir, encoding: 'utf8' },
  );
  return { dir, run };
}

test('evidence-writer consumes the raw logrus k6 log the workflow feeds it', async () => {
  const { dir, run } = await runWriterOnLog(productionRunLog(inEvidence()), [
    '--manifest', path.join(manifestsDir, 'r-cd-in-1.json'),
    '--scenario', 'r-cd-in-1-typed-input-snapshot.js',
  ]);
  try {
    assert.equal(run.status, 0, run.stderr);
    const { runDir } = JSON.parse(run.stdout);
    const result = JSON.parse(await readFile(path.join(dir, runDir, 'row-result.json'), 'utf8'));

    // The seams the writer previously exited before reaching.
    assert.equal(result.outcome, 'PASS-candidate');
    assert.equal(result.verdictSource, 'receipt-map-recomputed');
    assert.equal(result.rowId, 'R-CD-IN-1');
    assert.equal(result.scenario, 'r-cd-in-1-typed-input-snapshot.js');
    assert.deepEqual(result.receiptAudit.missingReceipts, []);
    assert.ok(result.liveRunSafety, 'liveRunSafety must be captured from the manifest');
    assert.equal(result.liveRunSafety.foldRequiresReview, true);

    const runLog = await readFile(path.join(dir, runDir, 'k6-run.log'), 'utf8');
    assert.match(runLog, /PUBLIC_EVIDENCE/);
    assert.ok(!runLog.includes(NONCE), 'the sanitized run log must not carry the nonce');
    assert.ok(!runLog.includes(CHILD_SESSION), 'the sanitized run log must not carry the child key');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('evidence-writer refuses an unsupported PASS through production framing too', async () => {
  const weakened = inEvidence();
  delete weakened.receipts['child-bytes-bound-to-canary'];
  const { dir, run } = await runWriterOnLog(productionRunLog(weakened), [
    '--manifest', path.join(manifestsDir, 'r-cd-in-1.json'),
  ]);
  try {
    assert.equal(run.status, 1);
    assert.match(run.stderr, /receipt map does not support it/);
    const proofsRoot = path.join(dir, 'PROOFS');
    await assert.rejects(
      readFile(proofsRoot),
      /ENOENT/,
      'a rejected PASS must not leave an uploadable success-shaped run directory',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('evidence-writer names the marker-without-record case distinctly', async () => {
  const truncated = [
    k6Line('\n--- R-CD-IN-1 EVIDENCE SUMMARY ---'),
    k6Line('{ "row": "R-CD-IN-1",'),
    k6Line('--- END EVIDENCE ---'),
    '',
  ].join('\n');
  const { dir, run } = await runWriterOnLog(truncated, []);
  try {
    assert.equal(run.status, 1);
    assert.match(run.stderr, /no evidence record parsed/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- manifest path normalization ---------------------------------------------

let normalizeManifestOpenPath;

test('manifest-loader normalizes every accepted manifest_path form for k6 open()', async () => {
  // manifest-loader.js imports `k6/data`, which Node cannot resolve. Load the
  // shipped source with only that import removed so the assertions run against
  // the exact function k6 executes.
  const source = await readFile(path.join(k6Root, 'lib/manifest-loader.js'), 'utf8');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'p86-manifest-loader-'));
  const modulePath = path.join(dir, 'manifest-loader.mjs');
  await writeFile(modulePath, source.replace(/^import .*'k6\/data';$/m, ''));
  try {
    ({ normalizeManifestOpenPath } = await import(pathToFileURL(modulePath).href));

    // The repo-root form the workflow, live-run-guard and evidence-writer use.
    assert.equal(
      normalizeManifestOpenPath('tools/k6-proofs/manifests/r-cd-in-1.json'),
      '../manifests/r-cd-in-1.json',
    );
    // Previously this produced tools/k6-proofs/tools/k6-proofs/manifests/... .
    assert.doesNotMatch(
      normalizeManifestOpenPath('tools/k6-proofs/manifests/r-cd-in-1.json'),
      /tools\/k6-proofs/,
    );
    assert.equal(normalizeManifestOpenPath('./tools/k6-proofs/manifests/r-cd-in-1.json'), '../manifests/r-cd-in-1.json');
    assert.equal(normalizeManifestOpenPath('manifests/r-cd-in-1.json'), '../manifests/r-cd-in-1.json');
    assert.equal(normalizeManifestOpenPath('./manifests/r-cd-in-1.json'), '../manifests/r-cd-in-1.json');
    assert.equal(normalizeManifestOpenPath('r-cd-in-1.json'), '../manifests/r-cd-in-1.json');
    assert.equal(normalizeManifestOpenPath('/srv/manifests/r-cd-in-1.json'), '/srv/manifests/r-cd-in-1.json');
    assert.equal(normalizeManifestOpenPath(''), null);
    assert.equal(normalizeManifestOpenPath(undefined), null);

    // Production-shaped proof: k6 resolves a relative open() against the
    // running scenario's directory, so the normalized value must land on the
    // real manifest file on disk for the exact value the workflow exports.
    const scenarioDir = path.join(k6Root, 'scenarios');
    const resolved = path.resolve(
      scenarioDir,
      normalizeManifestOpenPath('tools/k6-proofs/manifests/r-cd-in-1.json'),
    );
    assert.equal(resolved, path.join(manifestsDir, 'r-cd-in-1.json'));
    const loaded = JSON.parse(await readFile(resolved, 'utf8'));
    assert.equal(loaded.rowId, 'R-CD-IN-1');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('k6 archive receives a present manifest env and rejects malformed JSON in init context', async (t) => {
  const k6Bin = process.env.K6_BIN || '/home/figs/bin/k6';
  if (!existsSync(k6Bin)) {
    t.skip('k6 binary unavailable at ' + k6Bin);
    return;
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), 'p86-k6-archive-'));
  const malformedManifest = path.join(dir, 'malformed.json');
  try {
    await writeFile(malformedManifest, '{ this is not JSON');
    const run = spawnSync(
      k6Bin,
      [
        'archive',
        '-e', 'OPENCLAW_ROW_MANIFEST=' + malformedManifest,
        path.join(k6Root, 'scenarios', 'r-cd-in-1-typed-input-snapshot.js'),
        '-O', path.join(dir, 'archive.tar'),
      ],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    assert.equal(run.status, 107, run.stdout + '\\n' + run.stderr);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- workflow contract -------------------------------------------------------

test('the workflow normalizes manifest_path once and exercises it in dry-run archive', async () => {
  const workflow = await readFile(path.join(repoRoot, '.github/workflows/k6-proof.yml'), 'utf8');

  assert.match(workflow, /id: inputs/, 'the validate step must publish the normalized value');
  assert.match(workflow, /echo "manifest_path=\$normalized" >> "\$GITHUB_OUTPUT"/);

  // Every downstream consumer must read the normalized output, never the raw input.
  const downstream = workflow.slice(workflow.indexOf('- name: Dry run'));
  assert.ok(
    !/MANIFEST_PATH: \$\{\{ github\.event\.inputs\.manifest_path \}\}/.test(downstream),
    'no consumer may read the un-normalized manifest_path input',
  );
  assert.match(
    workflow,
    /OPENCLAW_ROW_MANIFEST: \$\{\{ steps\.inputs\.outputs\.manifest_path \}\}/,
    'the live run must export the normalized manifest',
  );
  assert.match(
    workflow,
    /k6 archive \\\n\s*-e "OPENCLAW_ROW_MANIFEST=\$MANIFEST_PATH"/,
    'the dry run must pass the manifest through k6, whose archive mode excludes system env by default',
  );
});

test('the workflow uploads artifacts on the failure path', async () => {
  const workflow = await readFile(path.join(repoRoot, '.github/workflows/k6-proof.yml'), 'utf8');
  const uploadProof = workflow.slice(workflow.indexOf('- name: Upload proof artifacts'));
  assert.match(uploadProof, /if: \$\{\{ !cancelled\(\)/, 'a failing row must still publish its artifact');
  assert.match(uploadProof, /if-no-files-found: warn/);

  const writeEvidence = workflow.slice(
    workflow.indexOf('- name: Write evidence artifacts'),
    workflow.indexOf('- name: Sanitize run log for upload'),
  );
  assert.match(writeEvidence, /!cancelled\(\)/, 'evidence must be written for a failing row too');
  assert.match(
    writeEvidence,
    /steps\.k6run\.outputs\.conflict != 'true'/,
    'a flock-75 coordination failure must not be written as row evidence',
  );
});
