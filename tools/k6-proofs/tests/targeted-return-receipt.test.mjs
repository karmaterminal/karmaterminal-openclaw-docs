import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  assertPublicSafeTargetedReturnReceipt,
  canonicalTargetedReturnReceipt,
  collectTargetedReturnDeliveries,
  fingerprintIdentity,
  parseTargetedReturnDeliveryLine,
  resolveTargetedReturnAuthority,
  validateTargetedReturnReceipt,
} from '../lib/targeted-return-receipt.mjs';

const run = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const collector = path.join(repoRoot, 'tools/k6-proofs/scripts/collect-targeted-return-receipt.mjs');
const signingKey = 'targeted-return-unit-gateway-token';

const target = 'agent:main:r-cd-4-target';
const parent = 'agent:main:r-cd-4-parent';
const child = 'agent:main:subagent:child-aaa';
const wrongChild = 'agent:main:subagent:child-bbb';
const windowStart = Date.parse('2026-08-09T17:13:00.000-07:00');
const windowEnd = Date.parse('2026-08-09T17:14:00.000-07:00');

function line(ts, to, from) {
  return `${ts} cael node[1]: ${ts} [continuation:targeted-return] Delivered to ${to} from ${from}`;
}

const inWindow = '2026-08-09T17:13:29.848-07:00';
const outWindow = '2026-08-09T17:20:29.848-07:00';

function resolve(overrides = {}) {
  return resolveTargetedReturnAuthority({
    journalText: line(inWindow, target, child),
    targetSessionKey: target,
    parentSessionKey: parent,
    childSessionKey: child,
    windowStartMs: windowStart,
    windowEndMs: windowEnd,
    row: 'R-CD-4',
    structuralOk: true,
    signingKey,
    ...overrides,
  });
}

test('parses payload-free targeted-return delivery lines', () => {
  const parsed = parseTargetedReturnDeliveryLine(line(inWindow, target, child));
  assert.deepEqual(parsed.targetSessionKeys, [target]);
  assert.equal(parsed.childSessionKey, child);
  assert.equal(parsed.timestampMs, Date.parse(inWindow));
});

test('exact single target receipt PASSes with zero parent receipts and HMAC seal', () => {
  const receipt = resolve({
    journalText: [line(inWindow, target, child), 'unrelated noise'].join('\n'),
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(receipt.targetMatchCount, 1);
  assert.equal(receipt.parentMatchCount, 0);
  assert.equal(receipt.failureCategory, null);
  assert.equal(receipt.structuralOk, true);
  assert.equal(receipt.integrity.algorithm, 'hmac-sha256-gateway-token-v1');
  assert.match(receipt.integrity.signature, /^[a-f0-9]{64}$/i);
  assert.deepEqual(validateTargetedReturnReceipt(receipt, signingKey, 'R-CD-4'), {
    valid: true,
    verdict: 'PASS-candidate',
  });
  assertPublicSafeTargetedReturnReceipt(receipt);
});

test('no delivery fails closed', () => {
  const receipt = resolve({ journalText: 'no targeted return here\n' });
  assert.equal(receipt.verdict, 'PARTIAL-candidate');
  assert.equal(receipt.failureCategory, 'no-delivery');
  assert.equal(validateTargetedReturnReceipt(receipt, signingKey).valid, true);
});

test('duplicate target receipts fail closed', () => {
  const receipt = resolve({
    journalText: [
      line(inWindow, target, child),
      line('2026-08-09T17:13:40.000-07:00', target, child),
    ].join('\n'),
  });
  assert.equal(receipt.failureCategory, 'duplicate-target');
  assert.equal(receipt.verdict, 'PARTIAL-candidate');
});

test('wrong-target delivery does not PASS', () => {
  const receipt = resolve({ journalText: line(inWindow, 'agent:main:other-target', child) });
  assert.equal(receipt.failureCategory, 'no-matching-delivery');
});

test('wrong-child delivery does not PASS', () => {
  const receipt = resolve({ journalText: line(inWindow, target, wrongChild) });
  assert.equal(receipt.failureCategory, 'wrong-child');
});

test('out-of-window delivery does not PASS', () => {
  const receipt = resolve({ journalText: line(outWindow, target, child) });
  assert.equal(receipt.failureCategory, 'out-of-window');
});

test('parent delivery fails closed even with target match', () => {
  const receipt = resolve({
    journalText: [
      line(inWindow, target, child),
      line('2026-08-09T17:13:35.000-07:00', parent, child),
    ].join('\n'),
  });
  assert.equal(receipt.failureCategory, 'parent-delivery');
  assert.equal(receipt.parentMatchCount, 1);
});

test('public receipt redacts raw identities and message bodies', () => {
  const receipt = resolve();
  const serialized = JSON.stringify(receipt);
  assert.equal(serialized.includes(target), false);
  assert.equal(serialized.includes(parent), false);
  assert.equal(serialized.includes(child), false);
  assert.equal(serialized.includes(signingKey), false);
  assert.equal(receipt.bindings.targetSessionFingerprint, fingerprintIdentity(target));
  assert.equal(receipt.bindings.childSessionFingerprint, fingerprintIdentity(child));
  assertPublicSafeTargetedReturnReceipt(receipt);
});

test('structuralOk false cannot PASS even with perfect journal match', () => {
  const receipt = resolve({ structuralOk: false });
  assert.equal(receipt.verdict, 'PARTIAL-candidate');
  assert.equal(receipt.structuralOk, false);
  assert.equal(receipt.failureCategory, 'structural-gates-incomplete');
  assert.deepEqual(validateTargetedReturnReceipt(receipt, signingKey, 'R-CD-4'), {
    valid: true,
    verdict: 'PARTIAL-candidate',
  });

  // Hand-forged PASS with structuralOk:false must be rejected by validator,
  // even when counts/fingerprints look valid and a signature is present.
  const forged = {
    ...receipt,
    verdict: 'PASS-candidate',
    failureCategory: null,
    structuralOk: false,
  };
  forged.integrity = {
    algorithm: 'hmac-sha256-gateway-token-v1',
    signature: createHmac('sha256', signingKey)
      .update(canonicalTargetedReturnReceipt(forged))
      .digest('hex'),
  };
  assert.deepEqual(validateTargetedReturnReceipt(forged, signingKey, 'R-CD-4'), {
    valid: false,
    reason: 'pass-structural-ok',
  });
});

test('missing token, forged unsigned PASS, and tampered seal are rejected', () => {
  const good = resolve();
  assert.equal(validateTargetedReturnReceipt(good, signingKey).valid, true);
  assert.deepEqual(validateTargetedReturnReceipt(good, ''), {
    valid: false,
    reason: 'missing-signing-key',
  });
  assert.deepEqual(validateTargetedReturnReceipt(good, undefined), {
    valid: false,
    reason: 'missing-signing-key',
  });
  assert.deepEqual(validateTargetedReturnReceipt(good, 'wrong-token'), {
    valid: false,
    reason: 'invalid-integrity',
  });

  const unsigned = { ...good };
  delete unsigned.integrity;
  assert.deepEqual(validateTargetedReturnReceipt(unsigned, signingKey), {
    valid: false,
    reason: 'invalid-shape',
  });

  const forgedPass = {
    schema: good.schema,
    row: 'R-CD-4',
    authority: 'gateway-journal-targeted-return',
    candidateOnly: true,
    foldRequiresReview: true,
    verdict: 'PASS-candidate',
    failureCategory: null,
    structuralOk: false,
    window: good.window,
    targetMatchCount: 1,
    parentMatchCount: 0,
    deliveryCountInWindow: 1,
    deliveryCountTotal: 1,
    childBound: true,
    bindings: good.bindings,
  };
  assert.equal(validateTargetedReturnReceipt(forgedPass, signingKey).valid, false);
  assert.equal(validateTargetedReturnReceipt(forgedPass, signingKey).reason, 'invalid-shape');

  const tampered = {
    ...good,
    targetMatchCount: 99,
  };
  assert.deepEqual(validateTargetedReturnReceipt(tampered, signingKey), {
    valid: false,
    reason: 'invalid-integrity',
  });

  assert.throws(
    () => resolve({ signingKey: '' }),
    /missing gateway signing key/,
  );
});

test('collector CLI seals with OPENCLAW_GATEWAY_TOKEN and rejects missing token', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'targeted-return-cli-'));
  const evidence = {
    row: 'R-CD-4',
    tool_accepted: true,
    child_session: child,
    child_session_ambiguous: false,
    child_session_invalid: false,
    targetSessionKey: target,
    sessionKey: parent,
    dispatch_accepted_at_ms: windowStart,
    started: new Date(windowStart).toISOString(),
    ended: new Date(windowEnd - 1000).toISOString(),
  };
  const evidencePath = path.join(dir, 'evidence.json');
  const journalPath = path.join(dir, 'journal.log');
  await writeFile(evidencePath, JSON.stringify(evidence));
  await writeFile(journalPath, `${line(inWindow, target, child)}\n`);

  await assert.rejects(
    () => run('node', [
      collector,
      '--run-dir', dir,
      '--evidence', evidencePath,
      '--journal', journalPath,
      '--row', 'R-CD-4',
    ], { env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: '' } }),
    /targeted-return collector failed|OPENCLAW_GATEWAY_TOKEN/,
  );

  const { stdout } = await run('node', [
    collector,
    '--run-dir', dir,
    '--evidence', evidencePath,
    '--journal', journalPath,
    '--row', 'R-CD-4',
  ], { env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey } });
  const summary = JSON.parse(stdout);
  assert.equal(summary.verdict, 'PASS-candidate');
  assert.equal(summary.structuralOk, true);
  assert.equal(summary.integrity, 'hmac-sha256-gateway-token-v1');
  const receipt = JSON.parse(await readFile(path.join(dir, 'targeted-return-receipt.json'), 'utf8'));
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(receipt.structuralOk, true);
  assert.deepEqual(validateTargetedReturnReceipt(receipt, signingKey, 'R-CD-4'), {
    valid: true,
    verdict: 'PASS-candidate',
  });
  assertPublicSafeTargetedReturnReceipt(receipt);
  assert.equal(JSON.stringify(receipt).includes(signingKey), false);
  assert.equal(JSON.stringify(receipt).includes(child), false);

  // Structural incomplete evidence cannot mint PASS even with journal match.
  const incomplete = {
    ...evidence,
    tool_accepted: false,
  };
  const incompletePath = path.join(dir, 'evidence-incomplete.json');
  await writeFile(incompletePath, JSON.stringify(incomplete));
  const partial = await run('node', [
    collector,
    '--run-dir', dir,
    '--evidence', incompletePath,
    '--journal', journalPath,
    '--row', 'R-CD-4',
  ], { env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey } });
  const partialSummary = JSON.parse(partial.stdout);
  assert.equal(partialSummary.verdict, 'PARTIAL-candidate');
  assert.equal(partialSummary.structuralOk, false);
});

test('depth-2 collector cannot seal PASS when spawnedBy ancestry is ambiguous', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'targeted-return-chain-'));
  const root = 'agent:main:r-cd-chain-root';
  const depthOne = 'agent:main:subagent:depth-one';
  const depthTwo = 'agent:main:subagent:depth-two';
  const evidence = {
    row: 'R-CD-CHAINED-DEPTH-2',
    sessionKey: root,
    parent_dispatch_accepted: true,
    child_done_sentinel: true,
    grandchild_done_sentinel: true,
    child_session: depthOne,
    grandchild_session: depthTwo,
    child_authority_source: 'sessions.list spawnedBy ancestry',
    grandchild_authority_source: 'sessions.list spawnedBy ancestry',
    child_ancestry_confirmations: 2,
    grandchild_ancestry_confirmations: 2,
    grandchild_ancestry_confirmed_at_ms: windowStart + 30_000,
    ancestry_stable: true,
    ancestry_ambiguous: true,
    dispatch_accepted_at_ms: windowStart,
    started: new Date(windowStart).toISOString(),
    ended: new Date(windowEnd - 1000).toISOString(),
  };
  const evidencePath = path.join(dir, 'evidence.json');
  const journalPath = path.join(dir, 'journal.log');
  await writeFile(evidencePath, JSON.stringify(evidence));
  await writeFile(journalPath, `${line(inWindow, root, depthTwo)}\n`);

  const { stdout } = await run('node', [
    collector,
    '--run-dir', dir,
    '--evidence', evidencePath,
    '--journal', journalPath,
    '--row', 'R-CD-CHAINED-DEPTH-2',
  ], { env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey } });
  const summary = JSON.parse(stdout);
  assert.equal(summary.verdict, 'PARTIAL-candidate');
  assert.equal(summary.structuralOk, false);
});

test('depth-2 collector independently rejects a sub-30s stability claim', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'targeted-return-chain-fast-'));
  const root = 'agent:main:r-cd-chain-root';
  const depthOne = 'agent:main:subagent:depth-one';
  const depthTwo = 'agent:main:subagent:depth-two';
  const evidence = {
    row: 'R-CD-CHAINED-DEPTH-2',
    sessionKey: root,
    parent_dispatch_accepted: true,
    child_done_sentinel: true,
    grandchild_done_sentinel: true,
    child_session: depthOne,
    grandchild_session: depthTwo,
    child_authority_source: 'sessions.list spawnedBy ancestry',
    grandchild_authority_source: 'sessions.list spawnedBy ancestry',
    child_ancestry_confirmations: 2,
    grandchild_ancestry_confirmations: 2,
    ancestry_stable: true,
    ancestry_ambiguous: false,
    dispatch_accepted_at_ms: windowStart,
    grandchild_ancestry_confirmed_at_ms: windowStart + 12_000,
    started: new Date(windowStart).toISOString(),
    ended: new Date(windowEnd - 1000).toISOString(),
  };
  const evidencePath = path.join(dir, 'evidence.json');
  const journalPath = path.join(dir, 'journal.log');
  await writeFile(evidencePath, JSON.stringify(evidence));
  await writeFile(journalPath, `${line(inWindow, root, depthTwo)}\n`);

  const { stdout } = await run('node', [
    collector,
    '--run-dir', dir,
    '--evidence', evidencePath,
    '--journal', journalPath,
    '--row', 'R-CD-CHAINED-DEPTH-2',
  ], { env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: signingKey } });
  const summary = JSON.parse(stdout);
  assert.equal(summary.verdict, 'PARTIAL-candidate');
  assert.equal(summary.structuralOk, false);
});

test('replay redacted historical journal remains unproven (no manufactured PASS)', () => {
  const redacted = [
    '2026-08-09T17:13:29.848-07:00 cael node[1]: [continuation:targeted-return] Delivered to <redacted-session-key> from <redacted-session-key>',
  ].join('\n');
  const receipt = resolve({ journalText: redacted });
  assert.notEqual(receipt.verdict, 'PASS-candidate');
  assert.equal(collectTargetedReturnDeliveries(redacted).length, 1);
});
