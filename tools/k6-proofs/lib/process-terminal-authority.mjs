import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { PROCESS_REQUIRED_CHECKS, sha256, validateProcessReceipt } from './producer-receipt.mjs';

export function resolveProcessRowIdentity({ manifest, metadata, runResult, rowResult, summary, evidence, envelope }) {
  const identities = [manifest, metadata, runResult, runResult?.evidence, rowResult,
    summary, evidence, envelope?.run].flatMap((source) => [source?.row, source?.rowId])
    .filter((value) => value !== undefined && value !== null);
  return identities.length && identities.every((value) =>
    typeof value === 'string' && value.trim() === value && value.length > 0 &&
    value === identities[0]) ? identities[0] : null;
}

function readOptional(runDir, file) {
  try {
    return JSON.parse(readFileSync(path.join(runDir, file), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

export function processTerminalValid(inputs) {
  try {
    const { runDir } = inputs;
    const manifest = inputs.manifest ?? readOptional(runDir, 'row-manifest.json');
    const metadata = inputs.metadata ?? readOptional(runDir, 'runner-metadata.json');
    const runResult = inputs.runResult ?? readOptional(runDir, 'run-result.json');
    const rowResult = inputs.rowResult ?? readOptional(runDir, 'row-result.json');
    const fixtureResult = readOptional(runDir, 'fixture-result.json');
    const rowId = resolveProcessRowIdentity({ ...inputs, manifest, metadata, runResult, rowResult });
    if (!rowId || (fixtureResult && !resolveProcessRowIdentity({
      metadata: { row: rowId }, rowResult: fixtureResult,
    }))) return false;
    const declared = runResult?.processTerminalReceipt;
    if (!Object.hasOwn(PROCESS_REQUIRED_CHECKS, rowId)) {
      return !declared && metadata?.producerClassification !== 'process-local';
    }
    if (!resolveProcessRowIdentity({ manifest }) || !resolveProcessRowIdentity({ metadata }) ||
        !resolveProcessRowIdentity({ runResult })) return false;
    const sources = [metadata, runResult, rowResult, fixtureResult, inputs.summary, inputs.evidence];
    if (sources.some((source) =>
      [source?.candidateSha, source?.sha, source?.runtimeBuildSha].some((value) =>
        value !== undefined && value !== metadata.candidateSha) ||
      [source?.docsSha, source?.docsRef].some((value) =>
        value !== undefined && value !== metadata.docsRef))) return false;
    if (manifest.candidateSha !== undefined &&
        manifest.candidateSha !== '${OPENCLAW_CANDIDATE_SHA}' &&
        manifest.candidateSha !== metadata.candidateSha) return false;
    if (inputs.envelope?.candidate && (
      inputs.envelope.candidate.sha !== metadata.candidateSha ||
      inputs.envelope.candidate.docsRef !== metadata.docsRef)) return false;
    const authoritativeRunId = path.basename(realpathSync(runDir));
    if (path.basename(path.resolve(runDir)) !== authoritativeRunId ||
        metadata.runId !== authoritativeRunId ||
        (inputs.envelope?.run?.id !== undefined && inputs.envelope.run.id !== authoritativeRunId) ||
        [runResult, rowResult, fixtureResult, inputs.envelope?.run].some((source) =>
          source?.runId !== undefined && source.runId !== authoritativeRunId)) return false;
    const expectedFile = rowId === 'R-CW-7'
      ? 'process-local-prerequisite/process-terminal-receipt.json' : 'process-terminal-receipt.json';
    if (declared?.validated !== true || declared.file !== expectedFile) return false;
    const bytes = readFileSync(path.join(runDir, expectedFile));
    if (sha256(bytes) !== declared.sha256) return false;
    const receipt = JSON.parse(bytes);
    if (!validateProcessReceipt(receipt, {
      rowId, candidateSha: metadata.candidateSha, docsSha: metadata.docsRef,
      runId: authoritativeRunId, candidateTree: receipt.candidateTree,
      argvSha256: receipt.argvSha256, scriptSha256: receipt.scriptSha256,
      trustedIssuers: { 'catalog-process-observer': process.env.OPENCLAW_PROCESS_RECEIPT_KEY },
    })) return false;
    return Object.entries(receipt.artifactDigests).every(([file, digest]) =>
      sha256(readFileSync(path.join(runDir, path.dirname(expectedFile), file))) === digest);
  } catch {
    return false;
  }
}
