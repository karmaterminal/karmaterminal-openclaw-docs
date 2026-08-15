#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertPublicSafeTargetedReturnReceipt,
  resolveTargetedReturnAuthority,
  validateTargetedReturnReceipt,
} from '../lib/targeted-return-receipt.mjs';

function usage() {
  console.error(`Usage: node collect-targeted-return-receipt.mjs \\
  --run-dir <dir> --evidence <private-evidence.json> --journal <private-gateway.log> \\
  [--row R-CD-4|R-CD-CHAINED-DEPTH-2] [--journal-status captured|unavailable]

Requires OPENCLAW_GATEWAY_TOKEN in the environment to HMAC-seal the receipt.`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!['--run-dir', '--evidence', '--journal', '--row', '--journal-status'].includes(arg)) {
      throw new Error(`unexpected argument: ${arg}`);
    }
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    out[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    i += 1;
  }
  return out;
}

function windowFromEvidence(evidence) {
  const startMs = Number(evidence?.dispatch_accepted_at_ms);
  const endedMs = Date.parse(evidence?.ended);
  const startedMs = Date.parse(evidence?.started);
  const windowStartMs = Number.isFinite(startMs)
    ? startMs
    : (Number.isFinite(startedMs) ? startedMs : null);
  // Small pad absorbs journal clock skew after the VU closes.
  const windowEndMs = Number.isFinite(endedMs) ? endedMs + 15_000 : null;
  return { windowStartMs, windowEndMs };
}

function bindRow(evidence, rowHint) {
  const row = rowHint || evidence?.row;
  if (row === 'R-CD-4') {
    return {
      row,
      targetSessionKey: evidence?.targetSessionKey || evidence?.created_target_session_key || null,
      parentSessionKey: evidence?.sessionKey || evidence?.created_parent_session_key || null,
      childSessionKey: evidence?.child_session || null,
      structuralOk: evidence?.tool_accepted === true &&
        !!evidence?.child_session &&
        evidence?.child_session_ambiguous !== true &&
        evidence?.child_session_invalid !== true,
    };
  }
  if (row === 'R-CD-CHAINED-DEPTH-2') {
    return {
      row,
      // fanoutMode=tree routes grandchild completion up the ancestry to root
      // (and intermediate ancestors). Intermediate child is not a forbidden parent.
      targetSessionKey: evidence?.sessionKey || evidence?.created_session_key || null,
      parentSessionKey: evidence?.child_session || null,
      childSessionKey: evidence?.grandchild_session || null,
      allowIntermediateAncestorTargets: true,
      structuralOk: evidence?.parent_dispatch_accepted === true &&
        evidence?.child_done_sentinel === true &&
        evidence?.grandchild_done_sentinel === true &&
        !!evidence?.child_session &&
        !!evidence?.grandchild_session &&
        evidence.child_session !== evidence.grandchild_session &&
        evidence?.ancestry_ambiguous !== true &&
        evidence?.ancestry_stable === true &&
        Number(evidence?.child_ancestry_confirmations) >= 2 &&
        Number(evidence?.grandchild_ancestry_confirmations) >= 2 &&
        Number.isFinite(Number(evidence?.dispatch_accepted_at_ms)) &&
        Number.isFinite(Number(evidence?.grandchild_ancestry_confirmed_at_ms)) &&
        Number(evidence.grandchild_ancestry_confirmed_at_ms) -
          Number(evidence.dispatch_accepted_at_ms) >= 30_000 &&
        evidence?.child_authority_source === 'sessions.list spawnedBy ancestry' &&
        evidence?.grandchild_authority_source === 'sessions.list spawnedBy ancestry',
    };
  }
  throw new Error(`unsupported targeted-return row: ${row || '(missing)'}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.runDir || !args.evidence || !args.journal) {
    usage();
    process.exitCode = 2;
    return;
  }

  const signingKey = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (typeof signingKey !== 'string' || signingKey.length === 0) {
    throw new Error('OPENCLAW_GATEWAY_TOKEN is required to seal targeted-return receipts');
  }

  const runDir = path.resolve(args.runDir);
  const evidence = JSON.parse(await readFile(path.resolve(args.evidence), 'utf8'));
  const journalText = await readFile(path.resolve(args.journal), 'utf8');
  // An unread journal is an evidence gap, not a proven absence of routing.
  // The runner knows which it is; without that signal fall back to content.
  if (args.journalStatus && !['captured', 'unavailable'].includes(args.journalStatus)) {
    throw new Error(`unsupported journal status: ${args.journalStatus}`);
  }
  const journalAvailable = args.journalStatus
    ? args.journalStatus === 'captured'
    : null;
  const binding = bindRow(evidence, args.row);
  const { windowStartMs, windowEndMs } = windowFromEvidence(evidence);

  const receipt = resolveTargetedReturnAuthority({
    journalText,
    targetSessionKey: binding.targetSessionKey,
    parentSessionKey: binding.parentSessionKey,
    childSessionKey: binding.childSessionKey,
    windowStartMs,
    windowEndMs,
    row: binding.row,
    allowIntermediateAncestorTargets: binding.allowIntermediateAncestorTargets === true,
    structuralOk: binding.structuralOk === true,
    journalAvailable,
    signingKey,
  });

  const integrity = validateTargetedReturnReceipt(receipt, signingKey, binding.row);
  if (!integrity.valid) {
    throw new Error(`sealed targeted-return receipt failed self-validation: ${integrity.reason}`);
  }
  assertPublicSafeTargetedReturnReceipt(receipt);

  const outName = 'targeted-return-receipt.json';
  const outPath = path.join(runDir, outName);
  await writeFile(outPath, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    row: binding.row,
    verdict: receipt.verdict,
    failureCategory: receipt.failureCategory,
    structuralOk: receipt.structuralOk === true,
    journalAvailable: journalAvailable ?? (journalText.trim().length > 0),
    receipt: outName,
    targetMatchCount: receipt.targetMatchCount,
    parentMatchCount: receipt.parentMatchCount,
    integrity: receipt.integrity?.algorithm || null,
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`targeted-return collector failed: ${error.message}\n`);
  process.exitCode = 1;
});
