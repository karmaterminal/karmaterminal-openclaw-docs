#!/usr/bin/env node
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROWS = new Set(['PREFLIGHT', 'R-RC-1']);
const SAFE_TEXT = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

function safeText(value) {
  return typeof value === 'string' && SAFE_TEXT.test(value) ? value : null;
}

function authorityFromEvidence(row, evidence = {}) {
  return {
    schema: 'openclaw.k6.session-preparation-authority.v1',
    row,
    sessionSource: safeText(evidence.session_source),
    sessionClass: safeText(evidence.session_class),
    agentId: safeText(evidence.resolved_agent_id),
    requestedModel: {
      provider: safeText(evidence.requested_model_provider),
      id: safeText(evidence.requested_model),
    },
    effectiveModel: {
      provider: safeText(evidence.effective_model_provider),
      id: safeText(evidence.effective_model),
    },
    runtime: {
      id: safeText(evidence.effective_runtime_id),
      source: safeText(evidence.effective_runtime_source),
    },
    preparationComplete: evidence.preparation_complete === true,
    toolsEffectiveCallStage: safeText(evidence.tools_effective_call_stage),
    setupFailureCode: safeText(evidence.setup_failure_code),
  };
}

function parseArgs(argv) {
  const out = {};
  for (let index = 2; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!['--row', '--evidence', '--metadata'].includes(name) || !value) {
      throw new Error('usage: --row <PREFLIGHT|R-RC-1> --evidence <evidence.jsonl> --metadata <runner-metadata.json>');
    }
    out[name.slice(2)] = value;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const row = String(args.row || '').toUpperCase();
  if (!ROWS.has(row)) throw new Error(`unsupported preparation-authority row: ${row}`);

  const metadataPath = path.resolve(args.metadata);
  const evidencePath = path.resolve(args.evidence);
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  if (metadata.row !== row) throw new Error('runner metadata row does not match preparation row');

  const lines = (await readFile(evidencePath, 'utf8').catch(() => ''))
    .split(/\r?\n/)
    .filter(Boolean);
  let evidence = {};
  for (const line of lines) {
    const candidate = JSON.parse(line);
    if (candidate?.row === row) {
      evidence = candidate;
      break;
    }
  }

  metadata.preparationAuthority = authorityFromEvidence(row, evidence);
  const temporary = `${metadataPath}.preparation.tmp`;
  await writeFile(temporary, `${JSON.stringify(metadata, null, 2)}\n`);
  await rename(temporary, metadataPath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

export { authorityFromEvidence };
