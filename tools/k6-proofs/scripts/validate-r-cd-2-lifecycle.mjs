#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

function usage() {
  console.error('Usage: node validate-r-cd-2-lifecycle.mjs --correlation <path> --out <path>');
}

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!['--correlation', '--out'].includes(key) || !value || value.startsWith('--')) {
      throw new Error(`invalid argument: ${key}`);
    }
    args[key.slice(2)] = value;
    index += 1;
  }
  if (!args.out) throw new Error('--out is required');
  return args;
}

function isHex(value, length) {
  return new RegExp(`^[0-9a-f]{${length}}$`, 'i').test(String(value || ''));
}

function verdict(receipt) {
  const failures = [];
  if (!receipt) {
    failures.push('continuation-trace-correlation is missing');
  } else {
    if (receipt.schema !== 'openclaw.k6.continuation-trace-correlation.v1') failures.push('unexpected correlation schema');
    if (receipt.row !== 'R-CD-2') failures.push('correlation receipt is not for R-CD-2');
    if (receipt.continuation?.tool !== 'continue_delegate') failures.push('typed continue_delegate tool receipt is missing');
    if (receipt.continuation?.acceptSpan !== 'continuation.delegate.dispatch') failures.push('delegate dispatch receipt is missing');
    if (receipt.continuation?.fireSpan !== 'continuation.delegate.fire') failures.push('delegate fire receipt is missing');
    if (receipt.delegate?.mode !== 'silent-wake') failures.push('delegate mode is not silent-wake');
    if (receipt.sameTrace !== true || !isHex(receipt.traceId, 32)) failures.push('typed tool, dispatch, and fire are not correlated to one trace');
    if (!receipt.chainId || !isHex(receipt.dispatchSpanId, 16) || !isHex(receipt.fireSpanId, 16) || receipt.dispatchSpanId === receipt.fireSpanId) {
      failures.push('delegate dispatch/fire chain is incomplete');
    }
    if (!Array.isArray(receipt.toolSpanIds) || receipt.toolSpanIds.length !== 1 || !receipt.toolSpanIds.every((id) => isHex(id, 16))) {
      failures.push('expected exactly one typed tool execution span');
    }
    if (receipt.distinctSpans !== true) failures.push('typed tool, dispatch, and fire spans are not distinct');
    if (receipt.reason?.rawPersisted !== false || Object.hasOwn(receipt.reason || {}, 'raw')) failures.push('correlation receipt is not public-safe');
  }

  return {
    schema: 'openclaw.k6.r-cd-2-lifecycle-receipt.v1',
    row: 'R-CD-2',
    outcome: failures.length === 0 ? 'PASS-candidate' : 'PARTIAL-candidate',
    lifecycleReceipt: failures.length === 0 ? 'present' : 'missing',
    failureClass: failures.length === 0 ? null : 'continuation-lifecycle-missing',
    failures,
    correlation: receipt && failures.length === 0 ? {
      traceId: receipt.traceId,
      chainId: receipt.chainId,
      toolSpanId: receipt.toolSpanIds[0],
      dispatchSpanId: receipt.dispatchSpanId,
      fireSpanId: receipt.fireSpanId,
      mode: receipt.delegate.mode,
    } : null,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  let correlation = null;
  if (args.correlation) {
    try {
      correlation = JSON.parse(await readFile(args.correlation, 'utf8'));
    } catch {
      // A missing or malformed receipt is an explicit non-pass, not a parser crash.
    }
  }
  const result = verdict(correlation);
  await writeFile(args.out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
  process.exitCode = result.outcome === 'PASS-candidate' ? 0 : 1;
}

main().catch((error) => {
  usage();
  console.error(error?.stack || String(error));
  process.exitCode = 2;
});
