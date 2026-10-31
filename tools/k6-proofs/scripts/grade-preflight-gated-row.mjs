#!/usr/bin/env node
/**
 * grade-preflight-gated-row.mjs — the required-preflight gate for a live cap row.
 *
 * 🌊's F″ method ruling (Discord 1565895695586558120; openclaw-bootstrap#1727):
 * R-CW-5 and R-CW-6 are PASS only when their required preflight (the R-CW-5A or
 * R-CW-6A static check) passed at the same candidate. The fixture
 * (run-cost-cap-fixture.mjs / run-max-chain-fixture.mjs) owns the behavioral
 * verdict in fixture-result.json; this joins it with the preflight receipts the
 * row manifest's `requiredPreflights` names and caps a PASS-candidate at
 * PARTIAL-candidate unless every preflight passed at that candidate. It never
 * raises a verdict, and its output is still candidate-only and review-gated.
 *
 * Usage:
 *   node tools/k6-proofs/scripts/grade-preflight-gated-row.mjs \
 *     --manifest tools/k6-proofs/manifests/r-cw-5.json \
 *     --live-result <fixture-dir>/fixture-result.json \
 *     --preflight-receipt <preflight-run-dir>/required-preflight-receipt.json \
 *     [--out <fixture-dir>/preflight-gate.json] [--json]
 *
 * --preflight-receipt may repeat (one per required preflight) or be omitted, in
 * which case each preflight is missing. Exit 0 when the gated verdict is
 * PASS-candidate, 1 for any other gated verdict, 2 when the inputs cannot be
 * bound (unknown row, a receipt for a preflight the row does not require, a
 * live result without an exact candidate).
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  evaluateRequiredPreflight,
  gatePreflightedVerdict,
  isFullSha,
  PREFLIGHT_GATED_VERDICT_SCHEMA,
} from '../lib/required-preflight.mjs';

class BindError extends Error {}

function usage() {
  return 'Usage: node tools/k6-proofs/scripts/grade-preflight-gated-row.mjs --manifest <row-manifest.json> ' +
    '--live-result <fixture-result.json> [--preflight-receipt <required-preflight-receipt.json>]... [--out <file>] [--json]';
}

export function parseArgs(argv) {
  const args = { receipts: [], json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') { args.json = true; continue; }
    if (arg === '--help' || arg === '-h') { args.help = true; continue; }
    const value = argv[i + 1];
    if (!['--manifest', '--live-result', '--preflight-receipt', '--out'].includes(arg)) throw new BindError(`unexpected argument: ${arg}`);
    if (!value || value.startsWith('--')) throw new BindError(`missing value for ${arg}`);
    i += 1;
    if (arg === '--preflight-receipt') args.receipts.push(value);
    else if (arg === '--manifest') args.manifest = value;
    else if (arg === '--live-result') args.liveResult = value;
    else args.out = value;
  }
  if (!args.help && (!args.manifest || !args.liveResult)) throw new BindError(usage());
  return args;
}

function readJson(file, label) {
  let raw;
  try { raw = readFileSync(file); }
  catch (error) { throw new BindError(`${label} unreadable: ${error.message}`); }
  try { return { value: JSON.parse(raw.toString('utf8')), raw }; }
  catch (error) { throw new BindError(`${label} is not JSON: ${error.message}`); }
}

/** The row a fixture result belongs to: its `row` field, else its schema's row slug. */
function liveResultRow(result) {
  if (typeof result?.row === 'string') return result.row;
  const match = /^openclaw\.project81\.(r-[a-z0-9-]+)\.fixture-result\.v1$/.exec(result?.schema || '');
  return match ? match[1].toUpperCase() : null;
}

export function gradeRow({ manifest, liveResult, receipts }) {
  const requirements = Array.isArray(manifest?.requiredPreflights) ? manifest.requiredPreflights : [];
  if (requirements.length === 0) throw new BindError(`${manifest?.rowId} declares no requiredPreflights`);
  const resultRow = liveResultRow(liveResult);
  if (resultRow !== manifest.rowId) throw new BindError(`live result is for ${resultRow}, not ${manifest.rowId}`);
  const candidateSha = liveResult.candidateSha;
  if (!isFullSha(candidateSha)) throw new BindError('live result candidateSha must be a 40-character SHA');
  if (typeof liveResult.verdict !== 'string' || !liveResult.verdict) throw new BindError('live result has no verdict');

  const required = new Set(requirements.map((requirement) => requirement.rowId));
  for (const receipt of receipts) {
    const row = receipt.value?.preflightRow;
    if (!required.has(row)) {
      throw new BindError(`receipt ${receipt.file} is for ${row}, which is not a required preflight of ${manifest.rowId}`);
    }
  }

  const preflights = requirements.map((requirement) => {
    const supplied = receipts.filter((receipt) => receipt.value?.preflightRow === requirement.rowId);
    if (supplied.length > 1) {
      return {
        rowId: requirement.rowId,
        status: 'invalid',
        reasons: [`${supplied.length} receipts supplied for ${requirement.rowId}`],
        receiptFile: null,
        receiptSha256: null,
      };
    }
    const [receipt] = supplied;
    const { status, reasons } = evaluateRequiredPreflight({
      requirement,
      liveRowId: manifest.rowId,
      candidateSha,
      receipt: receipt?.value,
    });
    return {
      rowId: requirement.rowId,
      status,
      reasons,
      receiptFile: receipt ? receipt.file : null,
      receiptSha256: receipt ? receipt.sha256 : null,
    };
  });
  const gated = gatePreflightedVerdict({ verdict: liveResult.verdict, statuses: preflights.map((p) => p.status) });
  return {
    schema: PREFLIGHT_GATED_VERDICT_SCHEMA,
    row: manifest.rowId,
    candidateSha,
    behavioralVerdict: liveResult.verdict,
    verdict: gated.verdict,
    capped: gated.capped,
    preflights,
    candidateOnly: true,
    foldRequiresReview: true,
  };
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  const manifest = readJson(args.manifest, 'manifest').value;
  const liveResult = readJson(args.liveResult, 'live result').value;
  // Only a basename and a digest leave this process: private paths stay private.
  const receipts = args.receipts.map((file) => {
    const { value, raw } = readJson(file, `receipt ${path.basename(file)}`);
    return { file: path.basename(file), sha256: createHash('sha256').update(raw).digest('hex'), value };
  });
  const result = gradeRow({ manifest, liveResult, receipts });
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (args.out) writeFileSync(args.out, text);
  if (args.json) process.stdout.write(text);
  else {
    const detail = result.preflights.map((p) => `${p.rowId} ${p.status}`).join(', ');
    console.log(`${result.row}: ${result.verdict}${result.capped ? ` (capped from ${result.behavioralVerdict})` : ''}; ${detail} (${result.candidateSha})`);
  }
  return result.verdict === 'PASS-candidate' ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`grade-preflight-gated-row: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}
