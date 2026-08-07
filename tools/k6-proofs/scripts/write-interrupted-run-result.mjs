#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SHA = /^[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{16}$/;

function argsOf(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]; const value = argv[i + 1];
    if (!key?.startsWith('--') || value == null) throw new Error(`invalid argument near ${key || '(end)'}`);
    out[key.slice(2).replaceAll('-', '')] = value;
  }
  return out;
}

async function main() {
  const a = argsOf(process.argv);
  if (!a.rundir || a.row !== 'R-CD-TOKEN') throw new Error('R-CD-TOKEN run-dir and row are required');
  if (!SHA.test(a.candidatesha || '') || !SHA.test(a.runtimesha || '')) throw new Error('candidate/runtime SHA must be exact 40-character lowercase hex');
  if (!HASH.test(a.attempthash || '') || !HASH.test(a.noncehash || '')) throw new Error('attempt/nonce fingerprints must be 16-character lowercase hex');
  const dir = path.resolve(a.rundir);
  await mkdir(dir, { recursive: true });
  const runResult = path.join(dir, 'run-result.json');
  const now = new Date().toISOString();
  const receipt = {
    schema: 'openclaw.k6.r-cd-token.interruption-receipt.v1',
    row: a.row,
    candidateSha: a.candidatesha,
    runtimeBuildSha: a.runtimesha,
    attemptIdHash: a.attempthash,
    rowNonceHash: a.noncehash,
    phase: a.phase || 'unknown',
    cause: a.cause || 'runner-exit-before-terminal-result',
    proofTerminal: false,
    consumptionState: 'unknown-possibly-consumed',
    automaticRetryAllowed: false,
    candidateOutcome: 'PARTIAL-candidate',
    generatedAt: now,
  };
  const attemptStatePath = path.join(dir, 'attempt-state.json');
  try {
    const attemptState = JSON.parse(await readFile(attemptStatePath, 'utf8'));
    if (attemptState?.schema === 'openclaw.k6.r-cd-token.attempt-state.v1') {
      attemptState.phase = 'interrupted';
      attemptState.proofTerminal = false;
      attemptState.terminal = false;
      attemptState.consumptionState = 'unknown-possibly-consumed';
      attemptState.endedAt = now;
      attemptState.automaticRetryAllowed = false;
      await writeFile(attemptStatePath, `${JSON.stringify(attemptState, null, 2)}\n`);
    }
  } catch {
    // The interruption receipt remains authoritative if attempt-state is absent or malformed.
  }
  await writeFile(path.join(dir, 'interruption-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
  await writeFile(runResult, `${JSON.stringify({
    schema: 'openclaw.k6.run-result.v1',
    k6ExitCode: 130,
    postprocessExitCode: 1,
    effectiveExitCode: 130,
    endedAt: now,
    verdict: 'PARTIAL-candidate',
    verdictSource: 'runner-interruption-receipt',
    summaryFileVerdict: null,
    vuLogVerdict: null,
    summaryFiles: [],
    evidence: null,
    candidateOnly: true,
    foldRequiresReview: true,
    terminal: false,
    interruption: receipt,
    observability: {
      traceStatus: 'unknown', traceId: null, tempoTraceJson: null, correlationReceipt: null,
      serviceLogStatus: 'unknown', serviceLog: null, serviceLogCapture: null, serviceLogRedaction: null,
    },
    review: {
      status: 'review-pending',
      pendingReceipts: ['parser-detected', 'queue-identity', 'child-spawned', 'child-completed', 'parent-return-event', 'tempo-trace-json', 'continuation-trace-correlation'],
    },
  }, null, 2)}\n`);
}

main().catch((error) => { console.error(error.message || error); process.exitCode = 1; });
