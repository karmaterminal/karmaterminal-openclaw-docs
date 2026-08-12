import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  assertPublicSafeTargetedReturnReceipt,
  collectTargetedReturnDeliveries,
  fingerprintIdentity,
  parseTargetedReturnDeliveryLine,
  resolveTargetedReturnAuthority,
} from '../lib/targeted-return-receipt.mjs';

const run = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const collector = path.join(repoRoot, 'tools/k6-proofs/scripts/collect-targeted-return-receipt.mjs');

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

test('parses payload-free targeted-return delivery lines', () => {
  const parsed = parseTargetedReturnDeliveryLine(line(inWindow, target, child));
  assert.deepEqual(parsed.targetSessionKeys, [target]);
  assert.equal(parsed.childSessionKey, child);
  assert.equal(parsed.timestampMs, Date.parse(inWindow));
});

test('exact single target receipt PASSes with zero parent receipts', () => {
  const journal = [
    line(inWindow, target, child),
    'unrelated noise',
  ].join('\n');
  const receipt = resolveTargetedReturnAuthority({
    journalText: journal,
    targetSessionKey: target,
    parentSessionKey: parent,
    childSessionKey: child,
    windowStartMs: windowStart,
    windowEndMs: windowEnd,
    row: 'R-CD-4',
  });
  assert.equal(receipt.verdict, 'PASS-candidate');
  assert.equal(receipt.targetMatchCount, 1);
  assert.equal(receipt.parentMatchCount, 0);
  assert.equal(receipt.failureCategory, null);
  assertPublicSafeTargetedReturnReceipt(receipt);
});

test('no delivery fails closed', () => {
  const receipt = resolveTargetedReturnAuthority({
    journalText: 'no targeted return here\n',
    targetSessionKey: target,
    parentSessionKey: parent,
    childSessionKey: child,
    windowStartMs: windowStart,
    windowEndMs: windowEnd,
  });
  assert.equal(receipt.verdict, 'PARTIAL-candidate');
  assert.equal(receipt.failureCategory, 'no-delivery');
});

test('duplicate target receipts fail closed', () => {
  const journal = [
    line(inWindow, target, child),
    line('2026-08-09T17:13:40.000-07:00', target, child),
  ].join('\n');
  const receipt = resolveTargetedReturnAuthority({
    journalText: journal,
    targetSessionKey: target,
    parentSessionKey: parent,
    childSessionKey: child,
    windowStartMs: windowStart,
    windowEndMs: windowEnd,
  });
  assert.equal(receipt.failureCategory, 'duplicate-target');
  assert.equal(receipt.verdict, 'PARTIAL-candidate');
});

test('wrong-target delivery does not PASS', () => {
  const journal = line(inWindow, 'agent:main:other-target', child);
  const receipt = resolveTargetedReturnAuthority({
    journalText: journal,
    targetSessionKey: target,
    parentSessionKey: parent,
    childSessionKey: child,
    windowStartMs: windowStart,
    windowEndMs: windowEnd,
  });
  assert.equal(receipt.failureCategory, 'no-matching-delivery');
});

test('wrong-child delivery does not PASS', () => {
  const journal = line(inWindow, target, wrongChild);
  const receipt = resolveTargetedReturnAuthority({
    journalText: journal,
    targetSessionKey: target,
    parentSessionKey: parent,
    childSessionKey: child,
    windowStartMs: windowStart,
    windowEndMs: windowEnd,
  });
  assert.equal(receipt.failureCategory, 'wrong-child');
});

test('out-of-window delivery does not PASS', () => {
  const journal = line(outWindow, target, child);
  const receipt = resolveTargetedReturnAuthority({
    journalText: journal,
    targetSessionKey: target,
    parentSessionKey: parent,
    childSessionKey: child,
    windowStartMs: windowStart,
    windowEndMs: windowEnd,
  });
  assert.equal(receipt.failureCategory, 'out-of-window');
});

test('parent delivery fails closed even with target match', () => {
  const journal = [
    line(inWindow, target, child),
    line('2026-08-09T17:13:35.000-07:00', parent, child),
  ].join('\n');
  const receipt = resolveTargetedReturnAuthority({
    journalText: journal,
    targetSessionKey: target,
    parentSessionKey: parent,
    childSessionKey: child,
    windowStartMs: windowStart,
    windowEndMs: windowEnd,
  });
  assert.equal(receipt.failureCategory, 'parent-delivery');
  assert.equal(receipt.parentMatchCount, 1);
});

test('public receipt redacts raw identities and message bodies', () => {
  const receipt = resolveTargetedReturnAuthority({
    journalText: line(inWindow, target, child),
    targetSessionKey: target,
    parentSessionKey: parent,
    childSessionKey: child,
    windowStartMs: windowStart,
    windowEndMs: windowEnd,
  });
  const serialized = JSON.stringify(receipt);
  assert.equal(serialized.includes(target), false);
  assert.equal(serialized.includes(parent), false);
  assert.equal(serialized.includes(child), false);
  assert.equal(receipt.bindings.targetSessionFingerprint, fingerprintIdentity(target));
  assert.equal(receipt.bindings.childSessionFingerprint, fingerprintIdentity(child));
  assertPublicSafeTargetedReturnReceipt(receipt);
});

test('collector CLI emits public-safe receipt for R-CD-4 structural+journal PASS', async () => {
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
  const { stdout } = await run('node', [
    collector,
    '--run-dir', dir,
    '--evidence', evidencePath,
    '--journal', journalPath,
    '--row', 'R-CD-4',
  ]);
  const summary = JSON.parse(stdout);
  assert.equal(summary.verdict, 'PASS-candidate');
  const receipt = JSON.parse(await readFile(path.join(dir, 'targeted-return-receipt.json'), 'utf8'));
  assert.equal(receipt.verdict, 'PASS-candidate');
  assertPublicSafeTargetedReturnReceipt(receipt);
});

test('replay redacted historical journal remains unproven (no manufactured PASS)', () => {
  const redacted = [
    '2026-08-09T17:13:29.848-07:00 cael node[1]: [continuation:targeted-return] Delivered to <redacted-session-key> from <redacted-session-key>',
  ].join('\n');
  const receipt = resolveTargetedReturnAuthority({
    journalText: redacted,
    targetSessionKey: target,
    parentSessionKey: parent,
    childSessionKey: child,
    windowStartMs: windowStart,
    windowEndMs: windowEnd,
  });
  assert.notEqual(receipt.verdict, 'PASS-candidate');
  assert.equal(collectTargetedReturnDeliveries(redacted).length, 1);
});
