#!/usr/bin/env node
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  rCd2AuthorityIdentity,
  resolveRcd2AuthoritativeReceipt,
  validateRcd2AuthoritativeReceipt,
} from '../lib/r-cd-2-authoritative-receipt.mjs';
import {
  consumeRcd2Authority,
  establishRcd2AuthorityContext,
  R_CD_2_SELECTION_RECEIPT_FILE,
  signRcd2SelectedContextReceipt,
  validateRcd2SelectedContextReceipt,
} from '../lib/r-cd-2-authority-context.mjs';

function args(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || !argv[i + 1]) {
      throw new Error(
        'usage: --run-dir <dir> --evidence <private-json> [--correlation <private-json>] ' +
        'or --run-dir <dir> --context-only true plus explicit selected identity arguments',
      );
    }
    out[argv[i].slice(2)] = argv[i + 1];
  }
  if (!out['run-dir'] || (!out.evidence && out['context-only'] !== 'true')) {
    throw new Error('run-dir and evidence are required');
  }
  return out;
}

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { return null; }
}

async function main() {
  const input = args(process.argv);
  const runDir = path.resolve(input['run-dir']);
  const signingKey = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (input['context-only'] === 'true') {
    const identity = rCd2AuthorityIdentity({
      candidateSha: input['candidate-sha'],
      runtimeBuildSha: input['runtime-sha'],
      docsRef: input['docs-ref'],
      repository: input.repository,
      seat: input.seat,
      matrixId: input['matrix-id'],
      row: input.row,
      scenario: input.scenario,
      manifestPath: input['manifest-path'],
      manifestSha256: input['manifest-sha256'],
      scenarioPath: input['scenario-path'],
      scenarioSha256: input['scenario-sha256'],
    }, input['run-id']);
    const receipt = signRcd2SelectedContextReceipt({ identity, signingKey });
    const validation = validateRcd2SelectedContextReceipt(receipt, signingKey, identity);
    if (!validation.valid) {
      throw new Error(`new selected context receipt is unusable: ${validation.reason}`);
    }
    const target = path.join(runDir, R_CD_2_SELECTION_RECEIPT_FILE);
    await writeFile(target, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    process.stdout.write(`${JSON.stringify({
      authorityContextSelected: true,
      selectionReceipt: R_CD_2_SELECTION_RECEIPT_FILE,
      matrixId: identity.matrixId,
      runId: identity.runId,
    })}\n`);
    return;
  }
  const evidence = input.evidence ? await readJson(input.evidence) : null;
  const correlation = input.evidence
    ? await readJson(input.correlation || path.join(runDir, 'continuation-trace-correlation.json'))
    : null;
  const metadata = await readJson(path.join(runDir, 'runner-metadata.json'));
  const manifest = await readJson(path.join(runDir, 'row-manifest.json'));
  const context = establishRcd2AuthorityContext({
    root: input.root,
    runDir,
    selectedMatrixId: input['matrix-id'],
    manifest,
    metadata,
    evidence,
    derivationEvidence: evidence,
    correlation,
    signingKey,
  });
  const receipt = resolveRcd2AuthoritativeReceipt({
    evidence,
    correlation,
    identity: context.identity,
    signingKey,
  });
  const validation = validateRcd2AuthoritativeReceipt(
    receipt,
    signingKey,
    context.identity,
  );
  if (!validation.valid) {
    throw new Error(`new authoritative receipt is unusable: ${validation.reason}`);
  }
  const target = path.join(runDir, 'r-cd-2-authoritative-receipt.json');
  await writeFile(target, `${JSON.stringify(receipt, null, 2)}\n`);
  try {
    consumeRcd2Authority({
      root: input.root,
      runDir,
      selectedMatrixId: input['matrix-id'],
      manifest,
      metadata,
      evidence,
      correlation,
      signingKey,
      requireRunResult: false,
    });
  } catch (error) {
    await rm(target, { force: true });
    throw error;
  }
  process.stdout.write(`${JSON.stringify({
    verdict: receipt.verdict,
    failureCategory: receipt.failureCategory || null,
    diagnostics: receipt.diagnostics,
    receipt: path.basename(target),
    authorityValidated: true,
    matrixId: context.selected.matrixId,
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`R-CD-2 authoritative receipt failed: ${error.message}\n`);
  process.exitCode = 1;
});
