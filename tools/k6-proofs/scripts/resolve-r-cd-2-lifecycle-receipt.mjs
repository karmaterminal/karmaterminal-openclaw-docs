#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  R_CD_2_RECEIPT_SCHEMA,
  R_CD_2_FAILURE_CATEGORIES,
  localEvidenceIsComplete,
  privateBinding,
  publicFingerprint,
  sealRcd2LifecycleReceipt,
} from '../lib/r-cd-2-lifecycle-receipt.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--') || !argv[i + 1]) throw new Error('usage: --run-dir <dir> --evidence <private-evidence.json> [--correlation <private-correlation.json>]');
    out[argv[i].slice(2)] = argv[i + 1];
    i += 1;
  }
  return out;
}

function failureCategory(evidence) {
  const kind = evidence?.failure_receipt?.kind;
  return R_CD_2_FAILURE_CATEGORIES.has(kind) ? kind : 'missing-local-lifecycle-evidence';
}

export function resolveRcd2LifecycleReceipt({ evidence, correlation, signingKey }) {
  const base = {
    schema: R_CD_2_RECEIPT_SCHEMA,
    row: 'R-CD-2',
    authoritativeSource: 'r-cd-2-lifecycle-resolver',
    candidateOnly: true,
    foldRequiresReview: true,
    // These hashes bind the public projection to the two private acquisition
    // inputs that the resolver joined. They are not identifiers and are never
    // derived from prompt/session/trace strings individually.
    binding: {
      localEvidenceFingerprint: privateBinding({
        session_created: evidence?.session_created === true,
        session_unbound_confirmed: evidence?.session_unbound_confirmed === true,
        tool_accepted: evidence?.tool_accepted === true,
        sendRunFingerprint: evidence?.send_run_fingerprint || null,
        terminalRunFingerprint: evidence?.terminal_run_fingerprint || null,
        wakeRunFingerprint: evidence?.wake_run_fingerprint || null,
        terminalSuccessObserved: evidence?.terminal_success_observed === true,
        wakeObserved: evidence?.child_fire_or_completion_observed === true,
        dispatchFailureObserved: evidence?.dispatch_failure_observed === true,
      }),
      correlationFingerprint: privateBinding({
        tool: correlation?.continuation?.tool || null,
        acceptSpan: correlation?.continuation?.acceptSpan || null,
        fireSpan: correlation?.continuation?.fireSpan || null,
        mode: correlation?.delegate?.mode || null,
        traceId: correlation?.traceId || null,
        chainId: correlation?.chainId || null,
        dispatchSpanId: correlation?.dispatchSpanId || null,
        fireSpanId: correlation?.fireSpanId || null,
      }),
    },
  };
  if (!localEvidenceIsComplete(evidence)) {
    return sealRcd2LifecycleReceipt({ ...base, verdict: 'PARTIAL-candidate', failureCategory: failureCategory(evidence) }, signingKey);
  }
  const continuation = correlation?.continuation;
  const delegate = correlation?.delegate;
  const topology = Boolean(
    continuation?.tool === 'continue_delegate' &&
    continuation?.acceptSpan === 'continuation.delegate.dispatch' &&
    continuation?.fireSpan === 'continuation.delegate.fire' &&
    delegate?.mode === 'silent-wake' &&
    correlation?.sameTrace === true && correlation?.distinctSpans === true &&
    typeof correlation?.traceId === 'string' && /^[a-f0-9]{32}$/i.test(correlation.traceId) &&
    typeof correlation?.chainId === 'string' && correlation.chainId.length > 0 &&
    typeof correlation?.dispatchSpanId === 'string' && /^[a-f0-9]{16}$/i.test(correlation.dispatchSpanId) &&
    typeof correlation?.fireSpanId === 'string' && /^[a-f0-9]{16}$/i.test(correlation.fireSpanId)
  );
  if (!topology) return sealRcd2LifecycleReceipt({ ...base, verdict: 'PARTIAL-candidate', failureCategory: 'invalid-lifecycle-topology' }, signingKey);
  return sealRcd2LifecycleReceipt({
    ...base,
    verdict: 'PASS-candidate',
    lifecycle: {
      typedTool: 'continue_delegate',
      observedMode: 'silent-wake',
      sameTrace: true,
      sameChain: true,
      typedDelegateAccepted: true,
      dispatchObserved: true,
      fireObserved: true,
      terminalSuccessObserved: true,
      unboundSessionVerified: true,
      noChannelVerified: true,
      traceFingerprint: publicFingerprint(correlation.traceId),
      chainFingerprint: publicFingerprint(correlation.chainId),
      delegateFingerprint: publicFingerprint(`${correlation.dispatchSpanId}:${correlation.fireSpanId}`),
    },
  }, signingKey);
}

async function main() {
  const args = parseArgs(process.argv);
  const runDir = path.resolve(args['run-dir']);
  let evidence = null;
  let correlation = null;
  try { evidence = JSON.parse(await readFile(args.evidence, 'utf8')); } catch {}
  try { correlation = JSON.parse(await readFile(args.correlation || path.join(runDir, 'continuation-trace-correlation.json'), 'utf8')); } catch {}
  const receipt = resolveRcd2LifecycleReceipt({ evidence, correlation, signingKey: process.env.OPENCLAW_GATEWAY_TOKEN });
  await writeFile(path.join(runDir, 'r-cd-2-lifecycle-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(() => { process.stderr.write('R-CD-2 lifecycle receipt failed\n'); process.exitCode = 1; });
}
