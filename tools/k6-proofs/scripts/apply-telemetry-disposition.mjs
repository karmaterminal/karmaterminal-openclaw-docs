#!/usr/bin/env node
import { access, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { telemetryRebindFrom, telemetryPassBlockers } from '../lib/telemetry-rebind.js';
import { ensureTelemetryBackendStatus } from './lib/telemetry-backend-status-store.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!['--manifest', '--run-dir'].includes(key) || !value) {
      throw new Error('usage: --manifest <manifest.json> --run-dir <row-run-dir>');
    }
    args[key.slice(2).replace('-', '')] = value;
  }
  return args;
}

async function readJson(file, label) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is missing or invalid: ${error.message}`);
  }
}

async function nonEmptyFile(file) {
  try {
    return (await stat(file)).isFile() && (await stat(file)).size > 0;
  } catch {
    return false;
  }
}

function safeArtifactName(value) {
  return typeof value === 'string' && value.length > 0 &&
    !path.isAbsolute(value) && !value.includes('..') &&
    !value.includes('\\');
}

function structuralGatewayEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const out = {};
  for (const key of ['ts', 'kind', 'method', 'event', 'ok']) {
    const value = event[key];
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

async function normalizeSummary(runDir) {
  if (await nonEmptyFile(path.join(runDir, 'k6-summary.json'))) return;
  const names = (await readdir(runDir))
    .filter((name) => /(?:^|-)summary\.json$/iu.test(name) && name !== 'k6-summary.json')
    .sort();
  if (names.length === 0) return;
  await writeFile(
    path.join(runDir, 'k6-summary.json'),
    await readFile(path.join(runDir, names[0])),
    { mode: 0o600 },
  );
}

async function normalizeGatewayEvents(runDir) {
  const target = path.join(runDir, 'gateway-events.ndjson');
  if (await nonEmptyFile(target)) return;
  let evidence;
  try {
    const line = (await readFile(path.join(runDir, 'evidence.jsonl'), 'utf8'))
      .split(/\r?\n/u)
      .find((entry) => entry.trim());
    evidence = line ? JSON.parse(line) : null;
  } catch {
    evidence = null;
  }
  const sourceEvents = Array.isArray(evidence?.gatewayEventReceipts)
    ? evidence.gatewayEventReceipts
    : Array.isArray(evidence?.redacted_events)
      ? evidence.redacted_events
      : [];
  const events = sourceEvents.map(structuralGatewayEvent).filter(Boolean);
  if (events.length > 0) {
    await writeFile(
      target,
      `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
      { mode: 0o600 },
    );
  }
}

function evidenceMarkdown({ manifest, metadata, result }) {
  return `# ${manifest.rowId} - ${metadata.seat} - ${result.verdict}

> Candidate-only row-list output. Human review and an explicit corpus fold are required.

- Candidate SHA: \`${metadata.candidateSha}\`
- Harness ref: \`${metadata.docsRef}\`
- Run: \`${metadata.proofRunId || metadata.runId || 'row-list-runner'}\`
- Verdict source: \`${result.verdictSource}\`
- Backend disposition: \`${result.telemetryRebind?.backend?.disposition || 'not-required'}\`
- Backend complete: ${result.telemetryRebind?.backend?.complete === true ? 'yes' : 'no'}
- Missing required artifacts: ${
  result.telemetryRebind?.missingRequiredArtifacts?.length
    ? result.telemetryRebind.missingRequiredArtifacts.map((name) => `\`${name}\``).join(', ')
    : 'none'
}
`;
}

async function artifactStatuses(manifest, runDir) {
  const declared = manifest?.telemetryContract?.artifact?.requiredFiles || [];
  const statuses = [];
  for (const name of declared) {
    if (!safeArtifactName(name)) {
      statuses.push({ name, status: 'missing' });
      continue;
    }
    statuses.push({
      name,
      status: await nonEmptyFile(path.join(runDir, name)) ? 'present' : 'missing',
    });
  }
  return statuses;
}

async function receiptStatuses(manifest, runDir, runResult, backendStatus) {
  const declared = manifest?.telemetryContract?.rebindReceipts || [];
  const statuses = [];
  const exists = async (name) => await nonEmptyFile(path.join(runDir, name));
  let summary = {};
  try {
    summary = JSON.parse(await readFile(path.join(runDir, 'k6-summary.json'), 'utf8'));
  } catch {
    summary = {};
  }
  const asserted = summary.proof_receipts || summary.receipts || {};
  for (const name of declared) {
    let present = false;
    if (name === 'backend-completeness-receipt') {
      present = backendStatus.interactions.length > 0;
    } else if (name === 'degraded-response-classified') {
      present = asserted[name] === true &&
        ['complete', 'partial', 'unavailable', 'capped', 'unknown'].every(
          (status) => summary.classificationControls?.[status] === status,
        );
    } else if (name === 'rebind-key-set-published') {
      present = backendStatus.rebind.complete === true;
    } else if (name === 'slice-strategy-recorded') {
      present = asserted[name] === true && backendStatus.interactions.every((entry) =>
        typeof entry.sliceStrategy === 'string' && entry.sliceStrategy.length > 0);
    } else if (name === 'tempo-trace-json') {
      present = Boolean(runResult.observability?.tempoTraceJson) &&
        await exists(runResult.observability.tempoTraceJson);
    } else if (name === 'continuation-trace-correlation' ||
               name === 'typed-delegate-topology') {
      present = Boolean(runResult.observability?.correlationReceipt) &&
        await exists(runResult.observability.correlationReceipt);
    } else if (name === 'trace-id') {
      present = typeof runResult.observability?.traceId === 'string' &&
        runResult.observability.traceId.length > 0;
    } else {
      present = asserted[name] === true || asserted[name] === 'present' ||
        await exists(name) || await exists(`${name}.json`);
    }
    statuses.push({ name, status: present ? 'present' : 'absent' });
  }
  return statuses;
}

async function main() {
  const args = parseArgs(process.argv);
  const runDir = path.resolve(args.rundir);
  const manifest = await readJson(args.manifest, 'manifest');
  const metadata = await readJson(path.join(runDir, 'runner-metadata.json'), 'runner metadata');
  const runResultPath = path.join(runDir, 'run-result.json');
  const runResult = await readJson(runResultPath, 'run result');
  if (!manifest.telemetryContract) {
    process.stdout.write(`${JSON.stringify({ applied: false, reason: 'no-telemetry-contract' })}\n`);
    return;
  }
  metadata.proofRunId = path.basename(runDir);
  await normalizeSummary(runDir);
  await normalizeGatewayEvents(runDir);
  await writeFile(path.join(runDir, 'row-result.json'), `${JSON.stringify(runResult, null, 2)}\n`, {
    mode: 0o600,
  });
  await writeFile(
    path.join(runDir, 'EVIDENCE.md'),
    evidenceMarkdown({ manifest, metadata, result: runResult }),
    { mode: 0o600 },
  );
  const backendContract = manifest.telemetryContract.backendUnavailable;
  const backendStatus = await ensureTelemetryBackendStatus(
    path.join(runDir, 'backend-status.json'),
    {
      rowId: manifest.rowId,
      candidateSha: /^[a-f0-9]{40}$/u.test(metadata.candidateSha || '')
        ? metadata.candidateSha
        : null,
      seat: metadata.seat,
      proofRunId: path.basename(runDir),
      requiredCompletenessKeys: backendContract.requiredCompletenessKeys,
      rebindKeys: backendContract.rebindKeys,
      rebindValues: {
        candidate_sha: metadata.candidateSha,
        row_id: manifest.rowId,
        seat: metadata.seat,
        run_id: path.basename(runDir),
        proof_run_id: path.basename(runDir),
      },
    },
  );
  const telemetryRebind = telemetryRebindFrom({
    manifest,
    receiptStatuses: await receiptStatuses(manifest, runDir, runResult, backendStatus),
    backendStatus,
    artifactStatuses: await artifactStatuses(manifest, runDir),
  });
  const blockers = telemetryPassBlockers(telemetryRebind);
  if (runResult.verdict === 'PASS-candidate' && blockers.length > 0) {
    runResult.verdict = 'PARTIAL-candidate';
    runResult.verdictSource = `${runResult.verdictSource}+telemetry-disposition-policy`;
    runResult.failureClass = blockers[0].failureClass;
    runResult.reason =
      `withheld from PASS-candidate: ${blockers.map((entry) => entry.reason).join('; ')}`;
    const pending = new Set(runResult.review?.pendingReceipts || []);
    blockers.forEach((entry) => pending.add(entry.receipt));
    runResult.review = {
      status: 'review-pending',
      pendingReceipts: [...pending].sort(),
    };
  }
  runResult.telemetryRebind = telemetryRebind;
  runResult.observability = {
    ...(runResult.observability || {}),
    backendStatus: 'backend-status.json',
    backendDisposition: backendStatus.status,
    backendComplete: backendStatus.complete,
  };
  await writeFile(runResultPath, `${JSON.stringify(runResult, null, 2)}\n`, { mode: 0o600 });
  await writeFile(path.join(runDir, 'row-result.json'), `${JSON.stringify(runResult, null, 2)}\n`, {
    mode: 0o600,
  });
  await writeFile(
    path.join(runDir, 'EVIDENCE.md'),
    evidenceMarkdown({ manifest, metadata, result: runResult }),
    { mode: 0o600 },
  );
  await access(path.join(runDir, 'backend-status.json'));
  process.stdout.write(`${JSON.stringify({
    applied: true,
    verdict: runResult.verdict,
    backendDisposition: backendStatus.status,
    backendComplete: backendStatus.complete,
    blockers,
  })}\n`);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exitCode = 1;
});
