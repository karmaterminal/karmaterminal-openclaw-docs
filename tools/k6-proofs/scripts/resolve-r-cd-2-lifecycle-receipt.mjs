#!/usr/bin/env node
/**
 * Resolve R-CD-2's only pass authority from the strict continuation trace
 * correlation receipt.  This deliberately does not inspect prompts, RPC
 * errors, session keys, or raw event payloads.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function safeText(value, max = 128) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function safeHex(value, length) {
  return typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`, 'i').test(value);
}

function opaqueHash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

/**
 * Return a public-safe R-CD-2 verdict.  The correlation receipt is written by
 * collect-continuation-trace.mjs only after it has proved one trace containing
 * the typed tool span plus matching dispatch and fire spans.
 */
const SAFE_FAILURE_CATEGORIES = new Set([
  'provider-transport-error',
  'model-policy-rejected',
  'delegate-replay-unsafe',
  'dispatching-turn-failed',
  'dispatching-turn-replay-invalid',
  'dispatching-turn-aborted',
  'dispatching-turn-not-live',
]);

export function resolveRcd2LifecycleReceipt({ correlation, collectorPresent = true, failureReceipt = null }) {
  const base = {
    schema: 'openclaw.k6.r-cd-2-lifecycle-receipt.v1',
    row: 'R-CD-2',
    authoritativeSource: 'continuation-trace-correlation',
    candidateOnly: true,
    foldRequiresReview: true,
  };
  if (!collectorPresent || !correlation || typeof correlation !== 'object') {
    const failureCategory = SAFE_FAILURE_CATEGORIES.has(failureReceipt?.kind)
      ? failureReceipt.kind
      : 'missing-lifecycle-correlation';
    return { ...base, verdict: 'PARTIAL-candidate', failureCategory };
  }

  const continuation = correlation.continuation || {};
  const delegate = correlation.delegate || {};
  const hasTopology =
    continuation.tool === 'continue_delegate' &&
    continuation.acceptSpan === 'continuation.delegate.dispatch' &&
    continuation.fireSpan === 'continuation.delegate.fire' &&
    delegate.mode === 'silent-wake' &&
    correlation.sameTrace === true &&
    correlation.distinctSpans === true &&
    safeHex(correlation.traceId, 32) &&
    safeText(correlation.chainId) &&
    safeHex(correlation.dispatchSpanId, 16) &&
    safeHex(correlation.fireSpanId, 16) &&
    Array.isArray(correlation.toolSpanIds) &&
    correlation.toolSpanIds.length >= 1 &&
    correlation.toolSpanIds.every((id) => safeHex(id, 16));

  if (!hasTopology) {
    return { ...base, verdict: 'PARTIAL-candidate', failureCategory: 'invalid-lifecycle-topology' };
  }

  // Keep only hashes of opaque identifiers and observed topology facts.  In
  // particular, never copy query text, raw trace/chain/span IDs, reason data,
  // prompt text, errors, or a traceparent into the public row receipt.
  return {
    ...base,
    verdict: 'PASS-candidate',
    lifecycle: {
      typedTool: 'continue_delegate',
      observedMode: 'silent-wake',
      sameTrace: true,
      traceHash: opaqueHash(correlation.traceId.toLowerCase()),
      chainHash: opaqueHash(correlation.chainId),
      dispatchSpanHash: opaqueHash(correlation.dispatchSpanId.toLowerCase()),
      fireSpanHash: opaqueHash(correlation.fireSpanId.toLowerCase()),
      toolSpanCount: correlation.toolSpanIds.length,
    },
  };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, index, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[index + 1]]);
    return pairs;
  }, []));
  if (!args['run-dir']) throw new Error('usage: --run-dir <row-run-dir> [--correlation <receipt>]');
  const runDir = path.resolve(args['run-dir']);
  const correlationPath = args.correlation
    ? path.resolve(args.correlation)
    : path.join(runDir, 'continuation-trace-correlation.json');
  let correlation = null;
  let failureReceipt = null;
  let collectorPresent = true;
  try {
    correlation = JSON.parse(await readFile(correlationPath, 'utf8'));
  } catch {
    collectorPresent = false;
  }
  if (args.evidence) {
    try {
      const evidence = JSON.parse(await readFile(args.evidence, 'utf8'));
      failureReceipt = evidence?.failure_receipt || null;
    } catch {
      // The absence of parseable local evidence is itself non-authoritative;
      // do not surface parsing details in the public lifecycle receipt.
    }
  }
  const result = resolveRcd2LifecycleReceipt({ correlation, collectorPresent, failureReceipt });
  result.generatedAt = new Date().toISOString();
  await writeFile(path.join(runDir, 'r-cd-2-lifecycle-receipt.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Do not print an underlying private collector/RPC error into a public
    // artifact or caller log.  The row receipt carries only safe categories.
    console.error(`R-CD-2 lifecycle receipt failed: ${error.message}`);
    process.exitCode = 1;
  });
}
