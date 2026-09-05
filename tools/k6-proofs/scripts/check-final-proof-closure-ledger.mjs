#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/u;
const PRODUCERS = [
  'R-CD-COLLECTION-ON-COLLAPSE',
  'R-CW-7',
  'R-CW-DELEGATE-CHILD-LIVE',
  'R-CW-DELEGATE-TOKEN',
  'R-CW-MULTI',
  'R-CW-MULTI-COLLAPSE',
];
const PARTIAL_CONTROLS = [
  'R-CD-1',
  'R-CD-4',
  'R-CD-CHAINED-DEPTH-2',
  'R-CD-MODEL-TOOL',
  'R-CD-SILENT',
];
const CLOSED_R_CW = ['R-CW-5', 'R-CW-5A', 'R-CW-6', 'R-CW-6A'];

function sameSet(left, right) {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateFinalProofClosureLedger({ ledger, index, manifest }) {
  const errors = [];
  const add = (condition, message) => {
    if (!condition) errors.push(message);
  };

  add(ledger?.schema === 'openclaw.proofs.closure-wave-ledger.v1', 'invalid ledger schema');
  add(ledger?.status === 'PROOF_WAVE_READY', 'ledger is not PROOF_WAVE_READY');
  add(SHA.test(ledger?.canonical?.pure_sha || ''), 'ledger pure SHA is invalid');
  add(ledger?.canonical?.pure_sha === index?.current_sha, 'ledger/index pure SHA mismatch');
  add(ledger?.canonical?.pure_sha === manifest?.sha, 'ledger/manifest pure SHA mismatch');
  add(
    ledger?.canonical?.pure_tree === '5ff71a670d75022c45e0ecaf9ecddcf57d2a33a2',
    'ledger pure tree mismatch',
  );
  add(SHA.test(ledger?.canonical?.structural_checkpoint || ''), 'invalid structural checkpoint');
  add(sameJson(ledger?.canonical?.rollup, manifest?.rollup), 'ledger/manifest rollup mismatch');
  add(sameJson(ledger?.canonical?.rollup, index?.rollup), 'ledger/index rollup mismatch');
  add(
    ledger?.runtime?.classification === 'deployment-composite-not-final-product',
    'runtime must remain deployment-composite-not-final-product',
  );
  add(ledger?.runtime?.acceptance_reuse_after_successor === false, 'runtime reuse must be false');
  add(ledger?.presentation?.successor_sha === null, 'pending successor must remain null');
  add(
    Array.isArray(ledger?.policy?.immediate_acceptance_refires) &&
      ledger.policy.immediate_acceptance_refires.length === 0,
    'immediate acceptance refires must be empty',
  );

  const rows = Array.isArray(ledger?.rows) ? ledger.rows : [];
  const rowIds = rows.map((row) => row?.row);
  add(new Set(rowIds).size === rowIds.length, 'ledger rows are not unique');
  const nonPassRows = (manifest?.rows || [])
    .filter((row) => row.state !== 'pass')
    .map((row) => row.row);
  add(sameSet(rowIds, nonPassRows), 'ledger rows do not equal canonical non-PASS rows');
  for (const row of rows) {
    const canonical = manifest?.rows?.find((entry) => entry.row === row.row);
    add(canonical?.state === row.state, `${row.row} state differs from canonical manifest`);
    add(
      sameJson(canonical?.test_cases_executed || [], row.attempts || []),
      `${row.row} attempt ledger differs from canonical manifest`,
    );
    add(typeof row.command === 'string' && row.command.length > 0, `${row.row} command is missing`);
    add(typeof row.gate === 'string' && row.gate.length > 0, `${row.row} gate is missing`);
    add(
      typeof row.rejected_base === 'string' && row.rejected_base.length > 0,
      `${row.row} rejected base is missing`,
    );
    add(
      typeof row.successor_control === 'string' && row.successor_control.length > 0,
      `${row.row} successor control is missing`,
    );
  }

  add(sameSet(ledger?.producer_rows || [], PRODUCERS), 'producer row set mismatch');
  add(sameSet(ledger?.partial_control_rows || [], PARTIAL_CONTROLS), 'partial control set mismatch');

  const closedRows = Array.isArray(ledger?.closed_r_cw_rows) ? ledger.closed_r_cw_rows : [];
  add(sameSet(closedRows.map((row) => row.row), CLOSED_R_CW), 'closed R-CW row set mismatch');
  for (const row of closedRows) {
    const canonical = manifest?.rows?.find((entry) => entry.row === row.row);
    add(canonical?.state === 'pass', `${row.row} is not canonical PASS`);
    add(
      canonical?.test_cases_executed?.includes(row.run_id),
      `${row.row} closed run is not canonical`,
    );
  }

  const pathEvidence = ledger?.rrc2_path_specific_evidence || [];
  const elliott = pathEvidence.find((entry) => entry.path === 'elliott');
  const rune = pathEvidence.find((entry) => entry.path === 'rune');
  add(pathEvidence.length === 2, 'R-RC-2 path evidence must have exactly two entries');
  add(
    elliott?.context_usage === 10 && elliott?.threshold === 70,
    'Elliott numeric path evidence mismatch',
  );
  add(
    rune?.context_usage === null && rune?.threshold === null,
    'Rune path must remain unknown',
  );
  add(!Object.hasOwn(ledger, 'rrc2_aggregate'), 'R-RC-2 paths must not be averaged');

  const tokenLane = ledger?.existing_lanes?.find((lane) => lane.scope.includes('R-CD-TOKEN'));
  const rrc2Lane = ledger?.existing_lanes?.find((lane) => lane.scope.includes('R-RC-2'));
  add(
    tokenLane?.head === '7013c8e8a19f0ecdaab939d8d8cbab429f2404f3',
    'R-CD-TOKEN owner lane mismatch',
  );
  add(
    rrc2Lane?.head === 'e008fe0f1bd922211a7cf280827556626da9a341',
    'R-RC-2 owner lane mismatch',
  );

  const authority = rows.find((row) => row.row === 'R-CD-RETURN-COVENANT-AUTHORITY');
  add(
    authority?.successor_control?.includes('HTTP body') &&
      authority?.successor_control?.includes('stderr'),
    'authority restart control must retain HTTP body and replacement stderr',
  );
  const token = rows.find((row) => row.row === 'R-CD-TOKEN');
  add(token?.gate?.includes('7013c8e8'), 'R-CD-TOKEN must remain gated on approved fix');

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      canonicalSha: ledger?.canonical?.pure_sha ?? null,
      nonPassRows: rowIds.length,
      producerRows: ledger?.producer_rows?.length ?? 0,
      partialControls: ledger?.partial_control_rows?.length ?? 0,
      immediateAcceptanceRefires: ledger?.policy?.immediate_acceptance_refires?.length ?? null,
    },
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!['--ledger', '--index', '--manifest'].includes(name) || !value) {
      throw new Error(
        'Usage: check-final-proof-closure-ledger.mjs --ledger <file> --index <file> --manifest <file>',
      );
    }
    args[name.slice(2)] = value;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const values = await Promise.all(
    ['ledger', 'index', 'manifest'].map(async (name) =>
      JSON.parse(await readFile(path.resolve(args[name]), 'utf8')),
    ),
  );
  const result = validateFinalProofClosureLedger({
    ledger: values[0],
    index: values[1],
    manifest: values[2],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
