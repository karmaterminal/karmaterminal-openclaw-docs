// R-CD-RECIPIENT-AUTHORITY: a live, isolated-gateway row at pinned j12 (🌊's ruling, room msg
// 1567077062139838485; docs#536). Registration, the live-run guard's refusal, the verdict rules over
// fixture receipts (each case, each missing observation is never PASS), the product reason
// matchers, the control's refusals and its public-safe, signed case receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RRA_CASES,
  RRA_CASE_IDS,
  RRA_CASE_SCHEMA,
  RRA_J12,
  RRA_ROW,
  countParentAcks,
  evaluateContinuationConfig,
  evaluateModelSignIn,
  findDelegateDispatch,
  findOwnerAssignment,
  findReason,
  gradeRecipientAuthorityCase,
  gradeRecipientAuthorityRow,
  isAdmissionPolicyRefusal,
  lineNamesKey,
  listenerOwnedBy,
  matchReasonLine,
  observeTargetTranscript,
  routedToTarget,
  traceCorrelationMatches,
} from '../../lib/recipient-authority-row.mjs';
import {
  assembleCaseRecord,
  evaluateRecipientAuthorityTarget,
  gradeRowFromArtifacts,
  parseArgs,
  runRecipientAuthorityRow,
  sealCaseReceipt,
  verifyCaseReceipt,
} from '../run-recipient-authority-row.mjs';

const k6Root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = path.resolve(k6Root, '../..');
const manifestPath = path.join(k6Root, 'manifests', 'r-cd-recipient-authority.json');
const RUN = 'rra-0123456789abcdef';
const H = (c) => c.repeat(64);
const TRACE_ID = '0123456789abcdef0123456789abcdef';

/* ------------------------------------------------------------------------------------ */
/* Registration                                                                          */
/* ------------------------------------------------------------------------------------ */

test('the row is registered: manifest, control, scenario, docs, README line and pipeline entry', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.rowId, RRA_ROW);
  assert.equal(manifest.issue, 536);
  assert.equal(manifest.transport, 'websocket');
  assert.equal(manifest.invocation.tool, 'continue_delegate');
  assert.equal(manifest.invocation.control, 'tools/k6-proofs/scripts/run-recipient-authority-row.mjs');
  assert.equal(manifest.invocation.artifactClass, 'disposable-real-process');
  assert.equal(manifest.invocation.pinnedCandidate, RRA_J12);
  assert.deepEqual(manifest.invocation.cases, RRA_CASE_IDS);
  assert.equal(Object.hasOwn(manifest, 'verdictCap'), false, 'a disposable real process needs no cap');
  assert.equal(manifest.liveRunSafety.classification, 'orchestration-required');
  assert.equal(manifest.liveRunSafety.requiresHumanConfirmation, true);
  assert.equal(manifest.review.foldRequiresReview, true);
  const expected = new Set(manifest.expectedReceipts.map((receipt) => receipt.name));
  for (const name of manifest.liveRunSafety.requiredReceipts) assert.ok(expected.has(name), name);
  for (const name of ['tempo-trace-json', 'continuation-trace-correlation', 'refusal-reason', 'target-adoption-observation']) {
    assert.ok(manifest.liveRunSafety.requiredReceipts.includes(name), name);
  }
  assert.ok(existsSync(path.join(repoRoot, manifest.invocation.control)));
  assert.ok(existsSync(path.join(k6Root, 'scenarios', manifest.scenario.file)));
  const docs = readFileSync(path.join(k6Root, 'docs', 'R-CD-RECIPIENT-AUTHORITY.md'), 'utf8');
  assert.match(docs, new RegExp(RRA_J12));
  for (const caseId of RRA_CASE_IDS) assert.match(docs, new RegExp(`\`${caseId}\``), caseId);
  assert.match(docs, /## Operator procedure/);
  assert.match(docs, /5442236054/);
  const readme = readFileSync(path.join(k6Root, 'README.md'), 'utf8');
  assert.match(readme, /^\| R-CD-RECIPIENT-AUTHORITY \| `run-recipient-authority-row\.mjs` \|/m);
  const pipeline = readFileSync(path.join(k6Root, 'k6-proofs-pipeline.xml'), 'utf8');
  assert.match(pipeline, /<Row id="R-CD-RECIPIENT-AUTHORITY" [^>]*issue="docs#536"/);
  assert.match(pipeline, /<Manifest>tools\/k6-proofs\/manifests\/r-cd-recipient-authority\.json<\/Manifest>/);
});

test('the scenario header cites the j12 product path at every boundary the verdict rests on', () => {
  const scenario = readFileSync(path.join(k6Root, 'scenarios', 'r-cd-recipient-authority.js'), 'utf8');
  assert.match(scenario, new RegExp(RRA_J12));
  for (const anchor of [
    'src/config/sessions/session-recipient-authority-types.ts:87-92',
    'src/auto-reply/continuation/delegate-flow-store.ts:426-437',
    'src/config/sessions/session-accessor.sqlite-entry-store.ts:56-69',
    'session-accessor.sqlite-owner.ts:158-182',
    'session-accessor.sqlite-entry-mutation.ts:119-136',
    'session-sharing-store.native.ts:150-195',
    'src/agents/tools/continue-delegate-tool.ts:353-362',
    'src/auto-reply/continuation/delegate-dispatch.ts:267-290',
    'src/agents/subagent-announce.continuation-return.ts:104-212',
    'src/auto-reply/continuation/targeting.ts:240-254',
    'src/auto-reply/continuation/continuation-wake.ts:127-238',
    'src/auto-reply/reply/session-system-events.ts:153-211',
    'src/gateway/server-restart-sentinel-delivery.ts:226-243',
    'src/infra/session-delivery-queue-recovery.ts:149-156',
    'src/cli/gateway-cli/run-loop.ts:496-551',
  ]) {
    assert.ok(scenario.includes(anchor), anchor);
  }
});

test('live-run-guard refuses the row even with every live-run variable set', () => {
  for (const env of [{}, { OPENCLAW_GATEWAY_TOKEN: 'x'.repeat(32), OPENCLAW_SESSION_KEY: 'agent:main:main', OPENCLAW_CANDIDATE_SHA: RRA_J12 }]) {
    const result = spawnSync(process.execPath, [path.join(k6Root, 'scripts', 'live-run-guard.mjs'), '--manifest', manifestPath, '--json'], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, ...env },
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.ok, false);
    assert.ok(out.errors.some((error) => error.includes('orchestration-required')), out.errors.join('\n'));
  }
});

/* ------------------------------------------------------------------------------------ */
/* Verdict rules over fixture receipts                                                   */
/* ------------------------------------------------------------------------------------ */

function completeRecord(caseId) {
  const spec = RRA_CASES[caseId];
  const refusal = spec.family === 'refusal';
  const durable = refusal && spec.expectChild !== false;
  const record = {
    schema: RRA_CASE_SCHEMA,
    row: RRA_ROW,
    case: caseId,
    runId: RUN,
    candidateSha: RRA_J12,
    docsSha: 'd'.repeat(40),
    gates: {
      candidatePinned: true,
      buildInfoCommit: RRA_J12,
      stateIsolated: true,
      modelSignIn: true,
      crossSessionTargetingEnabled: true,
      gatewayStartedByHarness: true,
    },
    gateway: { generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }], restartedAtMs: null },
    scenario: { controlRunId: RUN, refusals: [], preflightOk: true },
    dispatch: { accepted: true, status: 'scheduled', capturedAtMs: 1000, reasonHash: 'abcdef0123456789', reasonLength: 120, delegateMode: spec.mode },
    child: { spawned: true, bound: true, done: true },
    target: {
      primed: true,
      probeRan: refusal,
      probeReplied: refusal,
      ackRuns: refusal ? 0 : 1,
      foreignRuns: refusal ? 0 : 1,
      unattributedAssistantRows: 0,
      returnMarkerRows: 0,
      adoptedDeliveryRows: 0,
    },
    parent: { ackRows: 0 },
    transition: { method: spec.transition, ok: spec.transition ? true : null, requestedAtMs: spec.transition ? 5000 : null, settledAtMs: spec.transition ? 5100 : null },
    park: { deliveredToTargetAtMs: 4000 },
    epochs: { captured: H('a'), afterTransition: spec.transition ? (durable ? H('b') : H('a')) : null, final: durable ? H('b') : H('a') },
    reason: durable ? { kind: 'replay-authority-changed', observedAtMs: 60000, generation: 0 } : null,
    config: null,
    trace: spec.expectChild === false ? null : { correlated: true },
    cleanup: { gatewayStopped: true, residue: false },
  };
  if (spec.probeAdopts) {
    // The probe turn adopts the parked silent return: the marker on its row and the ack in its run.
    record.target = { ...record.target, probeRan: true, probeReplied: false, ackRuns: 1, foreignRuns: 0, adoptedDeliveryRows: 1 };
  }
  if (caseId === 'unauthorized-admission') {
    record.dispatch = { accepted: false, status: 'error', capturedAtMs: null, reasonHash: 'abcdef0123456789', reasonLength: 120, delegateMode: spec.mode };
    record.transition.requestedAtMs = 500;
    record.child = { spawned: false, bound: false, done: false };
    record.reason = { kind: 'admission-policy', observedAtMs: 1000, generation: 0 };
    record.config = { restored: true };
    record.park = { deliveredToTargetAtMs: null };
    record.epochs = { captured: null, afterTransition: null, final: null };
  }
  if (caseId === 'unauthorized-dispatch') {
    record.transition.requestedAtMs = 2000;
    record.child = { spawned: false, bound: false, done: false };
    record.reason = { kind: 'dispatch-policy', observedAtMs: 31000, generation: 0 };
    record.config = { restored: true };
    record.park = { deliveredToTargetAtMs: null };
  }
  if (spec.restart) {
    record.gateway = {
      generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }, { index: 1, startedByHarness: true, ownedListenerThroughout: true }],
      restartedAtMs: 6000,
    };
    record.reason = { kind: 'replay-authority-changed', observedAtMs: 9000, generation: 1 };
  }
  return record;
}

const mutate = (record, fn) => {
  const copy = structuredClone(record);
  fn(copy);
  return copy;
};
const refusalCases = RRA_CASE_IDS.filter((caseId) => RRA_CASES[caseId].family === 'refusal');
const allowedCases = RRA_CASE_IDS.filter((caseId) => RRA_CASES[caseId].family === 'allowed');
const durableCases = refusalCases.filter((caseId) => RRA_CASES[caseId].expectChild !== false);

test('every case with its complete receipt chain grades PASS-candidate', () => {
  assert.deepEqual(RRA_CASE_IDS, [
    'allowed', 'allowed-across-reset', 'allowed-silent', 'unauthorized-admission', 'unauthorized-dispatch',
    'revoked-visibility', 'revoked-membership', 'revoked-owner', 'reassigned', 'replay-restart',
  ]);
  for (const caseId of RRA_CASE_IDS) {
    const graded = gradeRecipientAuthorityCase(completeRecord(caseId));
    assert.equal(graded.verdict, 'PASS-candidate', `${caseId}: ${JSON.stringify(graded)}`);
  }
});

test('a refusal is never PASS without the product reason, even with the absence fully observed', () => {
  for (const caseId of refusalCases) {
    const graded = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.reason = null; }));
    assert.equal(graded.verdict, 'MISSING-candidate', caseId);
    assert.ok(graded.missing.includes('refusal-reason-not-observed'), caseId);
    const wrongKind = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.reason.kind = 'routed'; }));
    assert.equal(wrongKind.verdict, 'MISSING-candidate', `${caseId} wrong kind`);
  }
});

test('a refusal is never PASS without the observed absence, even with the reason', () => {
  const holes = {
    'transcript-not-read': (r) => { r.target.ackRuns = null; },
    'transcript-not-read (wake runs)': (r) => { r.target.foreignRuns = undefined; },
    'transcript-not-read (parent)': (r) => { r.parent.ackRows = null; },
    'probe-turn-unobserved': (r) => { r.target.probeRan = false; },
    'probe-turn-unobserved (no reply)': (r) => { r.target.probeReplied = false; },
    'target-not-primed': (r) => { r.target.primed = false; },
    'unattributable-target-rows': (r) => { r.target.unattributedAssistantRows = 1; },
    'transcript-not-read (adoption marker)': (r) => { r.target.adoptedDeliveryRows = null; },
    'scenario-refused': (r) => { r.scenario.refusals = ['websocket error']; },
    'scenario-refused (unread)': (r) => { r.scenario.refusals = undefined; },
    'preflight-not-ok': (r) => { r.scenario.preflightOk = false; },
  };
  for (const caseId of refusalCases) {
    for (const [hole, fn] of Object.entries(holes)) {
      const graded = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), fn));
      assert.equal(graded.verdict, 'MISSING-candidate', `${caseId} ${hole}: ${JSON.stringify(graded)}`);
    }
  }
});

test('any adoption, ack, wake or landing of a refused return is FAIL-candidate', () => {
  const effects = {
    'refused-return-adopted': (r) => { r.target.ackRuns = 1; },
    'refused-return-adopted (product marker, no ack)': (r) => { r.target.adoptedDeliveryRows = 1; },
    'target-woken': (r) => { r.target.foreignRuns = 1; },
    'return-reached-target': (r) => { r.target.returnMarkerRows = 1; },
    'return-landed-in-parent': (r) => { r.parent.ackRows = 1; },
  };
  for (const caseId of refusalCases) {
    for (const [code, fn] of Object.entries(effects)) {
      const graded = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), fn));
      assert.equal(graded.verdict, 'FAIL-candidate', `${caseId} ${code}`);
      assert.ok(graded.contradictions.includes(code.replace(/ \(.*\)$/u, '')), `${caseId} ${code}: ${graded.contradictions}`);
    }
    // FAIL even when the reason was also logged: the product refused and still delivered.
    assert.equal(gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.ackRuns = 2; })).verdict, 'FAIL-candidate');
  }
});

test('a revoked, reassigned or replay case must park the return before the transition and advance the epoch', () => {
  for (const caseId of durableCases) {
    const late = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.park.deliveredToTargetAtMs = 5000; }));
    assert.ok(late.missing.includes('return-not-parked-before-transition'), caseId);
    assert.equal(late.verdict, 'MISSING-candidate');
    const unrouted = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.park.deliveredToTargetAtMs = null; }));
    assert.equal(unrouted.verdict, 'MISSING-candidate', caseId);
    const unmoved = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.epochs.afterTransition = r.epochs.captured; }));
    assert.ok(unmoved.missing.includes('transition-did-not-advance-epoch'), caseId);
    const unread = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.epochs.captured = null; }));
    assert.ok(unread.missing.includes('epochs-unread'), caseId);
    const earlyReason = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.reason.observedAtMs = 4500; }));
    assert.ok(earlyReason.missing.includes('refusal-reason-not-observed'), caseId);
    const noChild = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.child.done = false; }));
    assert.ok(noChild.missing.includes('child-not-bound'), caseId);
    const failedTransition = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.transition.ok = false; }));
    assert.ok(failedTransition.missing.includes('transition-not-observed'), caseId);
  }
});

test('replay-restart credits only a reason from the replacement generation, after the restart', () => {
  const base = completeRecord('replay-restart');
  for (const fn of [
    (r) => { r.reason.generation = 0; },
    (r) => { r.reason.observedAtMs = 5500; },
    (r) => { r.gateway.restartedAtMs = null; },
    (r) => { r.gateway.restartedAtMs = 4900; },
    (r) => { r.gateway.generations = r.gateway.generations.slice(0, 1); },
  ]) {
    const graded = gradeRecipientAuthorityCase(mutate(base, fn));
    assert.equal(graded.verdict, 'MISSING-candidate', JSON.stringify(graded));
  }
});

test('the unauthorized cases: a spawned or accepted delegate is FAIL; an unrestored policy is PARTIAL', () => {
  for (const caseId of ['unauthorized-admission', 'unauthorized-dispatch']) {
    const spawned = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.child.spawned = true; }));
    assert.equal(spawned.verdict, 'FAIL-candidate', caseId);
    assert.ok(spawned.contradictions.includes('refused-delegate-spawned'));
    const unobserved = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.child.spawned = null; }));
    assert.equal(unobserved.verdict, 'MISSING-candidate', caseId);
    const unrestored = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.config.restored = false; }));
    assert.equal(unrestored.verdict, 'PARTIAL-candidate', caseId);
  }
  const accepted = gradeRecipientAuthorityCase(mutate(completeRecord('unauthorized-admission'), (r) => {
    r.dispatch.accepted = true;
    r.dispatch.status = 'scheduled';
  }));
  assert.equal(accepted.verdict, 'FAIL-candidate');
  assert.ok(accepted.contradictions.includes('unauthorized-dispatch-accepted'));
  const beforeCapture = gradeRecipientAuthorityCase(mutate(completeRecord('unauthorized-dispatch'), (r) => { r.transition.requestedAtMs = 900; }));
  assert.ok(beforeCapture.missing.includes('policy-not-changed-after-capture'));
});

test('the allowed cases: adopted exactly once in the target, never the parent, epoch unchanged', () => {
  for (const caseId of allowedCases) {
    const cases = {
      'allowed-return-not-adopted': (r) => { r.target.ackRuns = 0; },
      'duplicate-adoption': (r) => { r.target.ackRuns = 2; },
      'duplicate-wake': (r) => { r.target.foreignRuns = 2; },
      'return-landed-in-parent': (r) => { r.parent.ackRows = 1; },
      'adopted-after-epoch-advance': (r) => { r.epochs.final = H('c'); },
      'duplicate-adoption (product marker)': (r) => { r.target.adoptedDeliveryRows = 2; },
    };
    for (const [code, fn] of Object.entries(cases)) {
      const graded = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), fn));
      assert.equal(graded.verdict, 'FAIL-candidate', `${caseId} ${code}`);
      assert.ok(graded.contradictions.includes(code.replace(/ \(.*\)$/u, '')), `${caseId} ${code}: ${graded.contradictions}`);
    }
    for (const fn of [
      (r) => { r.park.deliveredToTargetAtMs = null; r.target.ackRuns = 0; },
      (r) => { r.child.bound = false; },
      (r) => { r.dispatch.accepted = null; },
      (r) => { r.epochs.captured = null; },
    ]) {
      assert.equal(gradeRecipientAuthorityCase(mutate(completeRecord(caseId), fn)).verdict, 'MISSING-candidate', caseId);
    }
    const noTrace = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.trace = null; }));
    assert.equal(noTrace.verdict, 'PARTIAL-candidate', caseId);
    assert.ok(noTrace.partial.includes('trace-receipt-pending'));
  }
  // sessions.reset is not an authority edge at j12: an epoch it advanced contradicts the case.
  const advanced = gradeRecipientAuthorityCase(mutate(completeRecord('allowed-across-reset'), (r) => { r.epochs.afterTransition = H('b'); }));
  assert.equal(advanced.verdict, 'FAIL-candidate');
  assert.ok(advanced.contradictions.includes('epoch-advanced-by-non-edge-transition'));
});

test('a record not about j12 on a harness-owned gateway is MISSING whatever else it shows', () => {
  const adoptedRefusal = (r) => { r.target.ackRuns = 1; };
  for (const [label, fn] of Object.entries({
    'candidate-not-j12': (r) => { r.candidateSha = 'f15237ec921879d918482cdf372b0718d4c1aab9'; },
    'gate:buildInfoCommit': (r) => { r.gates.buildInfoCommit = 'f15237ec921879d918482cdf372b0718d4c1aab9'; },
    'gateway-not-harness-owned': (r) => { r.gateway.generations[0].ownedListenerThroughout = false; },
    'gateway-not-harness-owned (none)': (r) => { r.gateway.generations = []; },
    'scenario-not-bound-to-run': (r) => { r.scenario.controlRunId = 'rra-ffffffffffffffff'; },
    ...Object.fromEntries(['candidatePinned', 'stateIsolated', 'modelSignIn', 'crossSessionTargetingEnabled', 'gatewayStartedByHarness']
      .map((key) => [`gate:${key}`, (r) => { r.gates[key] = 'true'; }])),
  })) {
    const graded = gradeRecipientAuthorityCase(mutate(completeRecord('revoked-visibility'), (r) => { fn(r); adoptedRefusal(r); }));
    assert.equal(graded.verdict, 'MISSING-candidate', label);
    assert.deepEqual(graded.contradictions, [], `${label}: not judged`);
  }
  for (const record of [null, {}, { ...completeRecord('allowed'), schema: 'other' }, { ...completeRecord('allowed'), case: 'stale' }]) {
    assert.equal(gradeRecipientAuthorityCase(record).verdict, 'MISSING-candidate');
  }
  assert.equal(gradeRecipientAuthorityCase(mutate(completeRecord('allowed'), (r) => { r.cleanup.residue = true; })).verdict, 'PARTIAL-candidate');
});

test('a transition that did not take effect is MISSING, never FAIL, whatever the return then did', () => {
  for (const caseId of [...refusalCases, 'allowed-across-reset']) {
    const failed = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => {
      r.transition.ok = false;
      r.target.ackRuns = 1;
      r.target.foreignRuns = 1;
      r.child.spawned = true;
      r.dispatch.accepted = true;
      r.dispatch.status = 'scheduled';
    }));
    assert.equal(failed.verdict, 'MISSING-candidate', `${caseId}: ${JSON.stringify(failed)}`);
    assert.deepEqual(failed.contradictions, [], caseId);
  }
  // A revocation that left the epoch where it was leaves the return current: its adoption is correct.
  for (const caseId of durableCases) {
    const unmoved = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => {
      r.epochs.afterTransition = r.epochs.captured;
      r.target.ackRuns = 1;
      r.target.adoptedDeliveryRows = 1;
    }));
    assert.equal(unmoved.verdict, 'MISSING-candidate', caseId);
    assert.ok(unmoved.missing.includes('transition-did-not-advance-epoch'));
    assert.deepEqual(unmoved.contradictions, []);
  }
});

test('allowed-silent is the control for the refusal cases\' absence: the product marker must show', () => {
  const unseen = gradeRecipientAuthorityCase(mutate(completeRecord('allowed-silent'), (r) => { r.target.adoptedDeliveryRows = 0; }));
  assert.equal(unseen.verdict, 'MISSING-candidate');
  assert.ok(unseen.missing.includes('adoption-marker-unobserved'));
  const woke = gradeRecipientAuthorityCase(mutate(completeRecord('allowed-silent'), (r) => { r.target.foreignRuns = 1; }));
  assert.equal(woke.verdict, 'FAIL-candidate');
  assert.ok(woke.contradictions.includes('silent-return-woke-target'));
  const unprobed = gradeRecipientAuthorityCase(mutate(completeRecord('allowed-silent'), (r) => { r.target.probeRan = false; }));
  assert.equal(unprobed.verdict, 'MISSING-candidate');
  // Without the control the row cannot be PASS: the refusal cases' marker absence would be unproven.
  const rows = RRA_CASE_IDS.filter((caseId) => caseId !== 'allowed-silent').map((caseId) => ({ record: completeRecord(caseId), verified: true }));
  assert.equal(gradeRecipientAuthorityRow(rows).verdict, 'MISSING-candidate');
});

test('the row stays MISSING until every case has a verified receipt, and moves only down', () => {
  const empty = gradeRecipientAuthorityRow([]);
  assert.equal(empty.verdict, 'MISSING-candidate');
  for (const caseId of RRA_CASE_IDS) assert.equal(empty.cases[caseId].verdict, 'MISSING-candidate');
  const all = RRA_CASE_IDS.map((caseId) => ({ record: completeRecord(caseId), verified: true }));
  assert.equal(gradeRecipientAuthorityRow(all).verdict, 'PASS-candidate');
  assert.equal(gradeRecipientAuthorityRow(all.slice(1)).verdict, 'MISSING-candidate');
  assert.equal(gradeRecipientAuthorityRow(all.map((entry, index) => (index === 4 ? { ...entry, verified: false } : entry))).verdict, 'MISSING-candidate');
  assert.equal(gradeRecipientAuthorityRow([...all, { record: completeRecord('allowed'), verified: false }]).verdict, 'PARTIAL-candidate');
  const failing = all.map((entry) => (entry.record.case === 'reassigned' ? { record: mutate(entry.record, (r) => { r.target.ackRuns = 1; }), verified: true } : entry));
  assert.equal(gradeRecipientAuthorityRow(failing).verdict, 'FAIL-candidate');
  const otherRun = all.map((entry, index) => (index === 0 ? { record: mutate(entry.record, (r) => { r.runId = 'rra-ffffffffffffffff'; r.scenario.controlRunId = r.runId; }), verified: true } : entry));
  assert.equal(gradeRecipientAuthorityRow(otherRun).verdict, 'MISSING-candidate');
  const conflicting = [...all, { record: mutate(completeRecord('allowed'), (r) => { r.trace = null; }), verified: true }];
  assert.equal(gradeRecipientAuthorityRow(conflicting).verdict, 'PARTIAL-candidate');
});

/* ------------------------------------------------------------------------------------ */
/* Product reason and transcript matchers                                                */
/* ------------------------------------------------------------------------------------ */

test('a reason line counts only as product text naming this case\'s own session key', () => {
  const target = 'agent:main:r-cd-ra-revoked-visibility-target-abc';
  const parent = 'agent:main:r-cd-ra-unauthorized-dispatch-parent-abc';
  const consoleLine = `2026-11-03T08:00:00.000Z [gateway/restart-sentinel] session event delivery skipped: recipient authority changed sessionKey=${target} queueId=q-1`;
  const wakeLine = `session event delivery wake skipped: recipient authority changed sessionKey=${target} queueId=q-1`;
  const fileLine = JSON.stringify({ 0: '{"subsystem":"gateway/restart-sentinel"}', 1: { sessionKey: target, queueId: 'q-1' }, 2: 'session event delivery skipped: recipient authority changed' });
  for (const line of [consoleLine, wakeLine, fileLine]) assert.equal(matchReasonLine(line, 'replay-authority-changed', { targetKey: target }), true, line);
  assert.equal(matchReasonLine(consoleLine, 'replay-authority-changed', { targetKey: `${target}x` }), false);
  assert.equal(matchReasonLine(consoleLine.replace(target, `${target}2`), 'replay-authority-changed', { targetKey: target }), false);
  assert.equal(matchReasonLine(`assistant said: recipient authority changed ${target}`, 'replay-authority-changed', { targetKey: target }), false);
  const rejected = `[continuation:delegate-rejected] policy.cross_session_targeting task=RCDRA:x session=${parent}`;
  assert.equal(matchReasonLine(rejected, 'dispatch-policy', { parentKey: parent }), true);
  assert.equal(matchReasonLine(rejected, 'dispatch-policy', { parentKey: target }), false);
  assert.equal(matchReasonLine(rejected, 'admission-policy', { parentKey: parent }), false, 'admission reasons come from the toolResult');
  assert.equal(lineNamesKey(`a=${target} b`, target), true);
  assert.equal(lineNamesKey(`a=${target}:child b`, target), false);
  assert.equal(findReason([{ atMs: 10, text: consoleLine }, { atMs: 30, text: wakeLine, generation: 1 }], 'replay-authority-changed', { targetKey: target }, 20).generation, 1);
  assert.equal(findReason([{ atMs: 10, text: consoleLine }], 'replay-authority-changed', { targetKey: target }, 20), null);
  assert.equal(isAdmissionPolicyRefusal('cross-session continuation targeting is disabled by agents.defaults.continuation.crossSessionTargeting.'), true);
  assert.equal(isAdmissionPolicyRefusal('task must be a non-empty string'), false);
});

test('the router line binds the return to the target only when the target is a listed recipient', () => {
  const target = 'agent:main:t';
  assert.equal(routedToTarget(`[continuation:targeted-return] Delivered to ${target} from agent:main:subagent:c`, target), true);
  assert.equal(routedToTarget(`[continuation:targeted-return] Delivered to agent:main:a,${target} from agent:main:subagent:c`, target), true);
  assert.equal(routedToTarget('[continuation:targeted-return] Delivered to  from agent:main:subagent:c', target), false, 'an empty list is every recipient refused');
  assert.equal(routedToTarget(`[continuation:targeted-return] Delivered to ${target}2 from agent:main:subagent:c`, target), false);
  assert.equal(routedToTarget(`[continuation:targeted-return] Held for retry to ${target} from c`, target), false);
});

const say = (text, runId) => ({ role: 'assistant', content: [{ type: 'text', text }], ...(runId ? { __openclaw: { runId } } : {}) });

test('target transcript: priming runs never count, any later ack does, and a heartbeat ack counts too', () => {
  const nonce = 'RCDRA-1-abc';
  const messages = [
    { role: 'user', content: [{ type: 'text', text: `[k6-proof-harness] priming ${nonce}` }] },
    say(`TARGET-READY ${nonce}`, 'run-prime'),
    say(`TARGET-ACK ${nonce}`, 'run-prime'),
    say(`PROBE-OK probe-1`, 'run-probe'),
  ];
  const quiet = observeTargetTranscript(messages, { nonce, primingRunIds: ['run-prime'], probeRunId: 'run-probe', probeNonce: 'probe-1' });
  assert.deepEqual(quiet, { ackRuns: 0, foreignRuns: 0, unattributedAssistantRows: 0, returnMarkerRows: 0, probeReplied: true, adoptedDeliveryRows: 0 });
  const marked = [...messages, { role: 'user', content: [{ type: 'text', text: 'probe' }], __openclaw: { sessionDeliveryAckIds: ['q-1'] } }];
  assert.equal(observeTargetTranscript(marked, { nonce, primingRunIds: ['run-prime'] }).adoptedDeliveryRows, 1, 'the product marker counts without any ack');
  const woken = observeTargetTranscript([...messages, say(`TARGET-ACK ${nonce}`, 'run-wake')], { nonce, primingRunIds: ['run-prime'] });
  assert.equal(woken.ackRuns, 1);
  assert.equal(woken.foreignRuns, 2, 'the probe run is foreign without a probeRunId');
  const inProbe = observeTargetTranscript([...messages, say(`TARGET-ACK ${nonce}`, 'run-probe')], { nonce, primingRunIds: ['run-prime'], probeRunId: 'run-probe', probeNonce: 'probe-1' });
  assert.equal(inProbe.ackRuns, 1, 'an ack in the probe run is the return adopted into the probe turn');
  const heartbeat = [
    ...messages,
    { role: 'assistant', content: [{ type: 'toolCall', id: 'hb-1', name: 'heartbeat_respond', arguments: { outcome: 'done', notify: true, summary: `TARGET-ACK ${nonce}` } }], __openclaw: { runId: 'run-hb' } },
    { role: 'toolResult', toolCallId: 'hb-1', toolName: 'heartbeat_respond', content: [{ type: 'text', text: JSON.stringify({ status: 'accepted', summary: `TARGET-ACK ${nonce}` }) }], __openclaw: { runId: 'run-hb' } },
  ];
  assert.equal(observeTargetTranscript(heartbeat, { nonce, primingRunIds: ['run-prime'], probeRunId: 'run-probe' }).ackRuns, 1);
  assert.equal(observeTargetTranscript([...messages, say('hello')], { nonce, primingRunIds: ['run-prime'] }).unattributedAssistantRows, 1);
  assert.equal(observeTargetTranscript([...messages, say(`RCDRA-RETURN ${nonce}`, 'run-probe')], { nonce, primingRunIds: ['run-prime'], probeRunId: 'run-probe' }).returnMarkerRows, 1);
  assert.equal(countParentAcks([say(`TARGET-ACK ${nonce}`, 'run-d')], nonce), 1);
});

test('dispatch binding: the case\'s own continue_delegate call, through Tool Search, paired by toolCallId', () => {
  const target = 'agent:main:t';
  const call = (id, args) => ({ role: 'assistant', content: [{ type: 'toolCall', id, name: 'dispatch_action', arguments: { id: 'openclaw:core:continue_delegate', args } }], __openclaw: { runId: 'run-d' } });
  const result = (id, payload, isError = false) => ({ role: 'toolResult', toolCallId: id, toolName: 'dispatch_action', isError, content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }] });
  const task = 'RCDRA:abc Proof nonce n: reply exactly RCDRA-RETURN n.';
  assert.deepEqual(findDelegateDispatch([call('c1', { task, targetSessionKey: target }), result('c1', { status: 'scheduled' })], { taskMarker: 'RCDRA:abc', targetSessionKey: target }), { status: 'scheduled', toolCallId: 'c1', errorText: null });
  const refused = findDelegateDispatch([call('c2', { task, targetSessionKey: target }), result('c2', 'cross-session continuation targeting is disabled by agents.defaults.continuation.crossSessionTargeting.', true)], { taskMarker: 'RCDRA:abc', targetSessionKey: target });
  assert.equal(refused.status, 'error');
  assert.equal(isAdmissionPolicyRefusal(refused.errorText), true);
  assert.equal(findDelegateDispatch([call('c3', { task, targetSessionKey: 'agent:main:other' }), result('c3', { status: 'scheduled' })], { taskMarker: 'RCDRA:abc', targetSessionKey: target }), null);
  assert.equal(findDelegateDispatch([call('c4', { task: 'other', targetSessionKey: target }), result('c4', { status: 'scheduled' })], { taskMarker: 'RCDRA:abc', targetSessionKey: target }), null);
  assert.deepEqual(findDelegateDispatch([call('c5', { task, targetSessionKey: target })], { taskMarker: 'RCDRA:abc', targetSessionKey: target }), { status: null, toolCallId: 'c5', errorText: null });
  const owner = [
    { role: 'assistant', content: [{ type: 'toolCall', id: 'o1', name: 'sessions', arguments: { action: 'assign_owner', sessionKey: target, ownerType: 'agent', ownerId: 'main' } }] },
    { role: 'toolResult', toolCallId: 'o1', toolName: 'sessions', content: [{ type: 'text', text: JSON.stringify({ status: 'updated' }) }] },
  ];
  assert.deepEqual(findOwnerAssignment(owner, target), { status: 'updated' });
  assert.equal(findOwnerAssignment(owner, 'agent:main:other'), null);
});

/* ------------------------------------------------------------------------------------ */
/* Gates and the control's refusals                                                      */
/* ------------------------------------------------------------------------------------ */

test('gates: model sign-in, cross-session policy and listener ownership fail closed', () => {
  const stateDir = '/home/u/proof-gw/comp-352f5602/state';
  const good = { auth: { storePath: `${stateDir}/agents/main/agent/auth.json`, missingProvidersInUse: [], providers: [{ provider: 'openai', profiles: { count: 1 } }] } };
  const sign = (status) => evaluateModelSignIn(status, { stateDir, primaryModel: 'openai/gpt-5.6', pathApi: path });
  assert.equal(sign(good).ok, true);
  for (const [code, status] of Object.entries({
    'model-status-unreadable': null,
    'model-auth-store-not-isolated': { auth: { ...good.auth, storePath: '/home/u/.openclaw/agents/main/agent/auth.json' } },
    'model-sign-in-missing': { auth: { ...good.auth, missingProvidersInUse: ['openai'] } },
    'model-sign-in-missing ': { auth: { ...good.auth, providers: [{ provider: 'openai', profiles: { count: 0 } }] } },
  })) {
    const result = sign(status);
    assert.equal(result.ok, false, code);
    assert.ok(result.refusals.some((entry) => entry.code === code.trim()), code);
  }
  assert.equal(evaluateContinuationConfig({ agents: { defaults: { continuation: { enabled: true, crossSessionTargeting: 'enabled' } } } }).ok, true);
  assert.equal(evaluateContinuationConfig({ agents: { defaults: { continuation: { enabled: true } } } }).ok, false, 'the default is disabled');
  assert.equal(listenerOwnedBy({ pid: 10, startTicks: 5 }, { pid: 10, startTicks: 5 }), true);
  assert.equal(listenerOwnedBy({ pid: 10, startTicks: 6 }, { pid: 10, startTicks: 5 }), false, 'a recycled PID is another process');
  assert.equal(listenerOwnedBy({ pid: 11, startTicks: 5 }, { pid: 10, startTicks: 5 }), false);
  assert.equal(listenerOwnedBy(null, { pid: 10, startTicks: 5 }), false);
});

function proofGwFixture({ buildCommit = RRA_J12, crossSession = 'enabled', stateLink = false } = {}) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'rra-home-'));
  const dir = path.join(home, 'proof-gw', 'comp-352f5602');
  const stage = path.join(home, 'stage');
  mkdirSync(path.join(dir, 'receipts'), { recursive: true });
  mkdirSync(path.join(home, '.openclaw'), { recursive: true });
  if (stateLink) symlinkSync(path.join(home, '.openclaw'), path.join(dir, 'state'));
  else mkdirSync(path.join(dir, 'state'));
  mkdirSync(path.join(stage, 'dist'), { recursive: true });
  writeFileSync(path.join(stage, 'dist', 'build-info.json'), JSON.stringify({ commit: buildCommit, buildId: 'b' }));
  writeFileSync(path.join(stage, 'dist', 'index.js'), '');
  writeFileSync(path.join(dir, 'receipts', 'identity.json'), JSON.stringify({ pure_candidate_P: RRA_J12, composite_runtime_C: RRA_J12, unit: 'openclaw-proof-comp-352f5602', port: 18899 }));
  writeFileSync(path.join(dir, 'openclaw.json'), JSON.stringify({
    gateway: { port: 18899, bind: 'loopback', auth: { mode: 'token', token: 't'.repeat(32) } },
    agents: { defaults: { model: { primary: 'openai/gpt-5.6' }, continuation: { enabled: true, crossSessionTargeting: crossSession } } },
  }));
  chmodSync(path.join(dir, 'openclaw.json'), 0o600);
  const keyFile = path.join(home, 'observer.key');
  writeFileSync(path.join(keyFile), 'k'.repeat(40));
  chmodSync(keyFile, 0o600);
  return { home, dir, stage, keyFile, cleanup: () => rmSync(home, { recursive: true, force: true }) };
}

function fakePlatform(fixture, overrides = {}) {
  const calls = { runCli: [], runK6: 0, spawnGateway: 0 };
  const platform = {
    home: () => fixture.home,
    now: (() => { let t = 1_000; return () => (t += 1_000); })(),
    sleep: async () => {},
    portListening: () => false,
    unitState: () => 'inactive',
    httpReady: async () => true,
    readAuthorityTable: () => ({ state: 'read', rows: [] }),
    gatewayRpc: async () => ({ ok: false }),
    listenerOwner: () => null,
    procStat: () => ({ state: 'S', ppid: 1, startTicks: 77 }),
    procEnvironHas: () => true,
    runCli: (call) => {
      calls.runCli.push(call);
      return { code: 0, stdout: JSON.stringify({ auth: { storePath: path.join(fixture.dir, 'state', 'agents', 'main', 'agent', 'auth.json'), missingProvidersInUse: [], providers: [{ provider: 'openai', profiles: { count: 1 } }] } }), stderr: '' };
    },
    runK6: async () => {
      calls.runK6 += 1;
      return { code: 0, log: '' };
    },
    spawnGateway: () => {
      calls.spawnGateway += 1;
      return { pid: 4242, lines: [], exited: new Promise(() => {}), signal: () => {} };
    },
    ...overrides,
  };
  return { platform, calls };
}

function controlOptions(fixture, extra = {}) {
  return {
    ...parseArgs(['node', 'x']),
    proofGwDir: fixture.dir,
    stageDir: fixture.stage,
    candidateSha: RRA_J12,
    docsSha: 'd'.repeat(40),
    artifactDir: path.join(fixture.home, 'artifacts'),
    observerKeyFile: fixture.keyFile,
    ...extra,
  };
}

test('the control accepts a stopped j12 proof-gw target and checks its sign-in against the isolated state only', () => {
  const fixture = proofGwFixture();
  try {
    const { platform, calls } = fakePlatform(fixture);
    const evaluated = evaluateRecipientAuthorityTarget(controlOptions(fixture), platform);
    assert.equal(evaluated.ok, true, JSON.stringify(evaluated.refusals));
    assert.deepEqual({ ...evaluated.gates }, {
      candidatePinned: true, buildInfoCommit: RRA_J12, stateIsolated: true, modelSignIn: true, crossSessionTargetingEnabled: true, gatewayStartedByHarness: false,
    });
    assert.equal(calls.runCli.length, 1);
    const env = calls.runCli[0].env;
    assert.equal(env.OPENCLAW_STATE_DIR, path.join(fixture.dir, 'state'));
    assert.equal(env.OPENCLAW_CONFIG_PATH, path.join(fixture.dir, 'openclaw.json'));
    for (const key of Object.keys(env)) assert.ok(!/TOKEN|SYSTEMD|GATEWAY_WS/u.test(key), key);
    assert.ok(!JSON.stringify(env).includes(path.join(fixture.home, '.openclaw')));
  } finally {
    fixture.cleanup();
  }
});

test('the control refuses: another candidate, a non-j12 build, a live-overlapping state, no sign-in, disabled policy, a gateway it did not start', () => {
  const cases = [
    ['candidate-not-pinned', {}, (o) => ({ ...o, candidateSha: 'f15237ec921879d918482cdf372b0718d4c1aab9' }), {}],
    ['stage-build-mismatch', { buildCommit: 'f15237ec921879d918482cdf372b0718d4c1aab9' }, (o) => o, {}],
    ['state-dir-overlaps-live', { stateLink: true }, (o) => o, {}],
    ['config-cross-session-disabled', { crossSession: 'disabled' }, (o) => o, {}],
    ['port-in-use', {}, (o) => o, { portListening: () => true }],
    ['unit-not-stopped', {}, (o) => o, { unitState: () => 'active' }],
    ['model-sign-in-missing', {}, (o) => o, { runCli: () => ({ code: 0, stdout: JSON.stringify({ auth: { storePath: '/x/state/a', missingProvidersInUse: ['openai'], providers: [] } }), stderr: '' }) }],
    ['observer-key-missing', {}, (o) => ({ ...o, observerKeyFile: undefined }), {}],
  ];
  for (const [code, fixtureOptions, options, overrides] of cases) {
    const fixture = proofGwFixture(fixtureOptions);
    try {
      const { platform } = fakePlatform(fixture, overrides);
      const evaluated = evaluateRecipientAuthorityTarget(options(controlOptions(fixture)), platform);
      assert.equal(evaluated.ok, false, code);
      assert.ok(evaluated.refusals.some((entry) => entry.code === code), `${code}: ${evaluated.refusals.map((entry) => entry.code)}`);
    } finally {
      fixture.cleanup();
    }
  }
});

test('the control runs no case on a gateway whose listener is not the process it started', async () => {
  const fixture = proofGwFixture();
  try {
    const { platform, calls } = fakePlatform(fixture, { listenerOwner: () => ({ pid: 9999, startTicks: 77 }) });
    const result = await runRecipientAuthorityRow(controlOptions(fixture), platform);
    assert.equal(result.ok, false);
    assert.ok(result.refusal.refusals.some((entry) => entry.code === 'gateway-not-started-by-harness'));
    assert.equal(calls.spawnGateway, 1);
    assert.equal(calls.runK6, 0);
  } finally {
    fixture.cleanup();
  }
});

/* ------------------------------------------------------------------------------------ */
/* Case records: assembly, public safety, signature, row grade                           */
/* ------------------------------------------------------------------------------------ */

function revokedEvidence() {
  return {
    row: RRA_ROW,
    case: 'revoked-visibility',
    phase: 'drive',
    control_run_id: RUN,
    candidate_sha: RRA_J12,
    keys: { parent: 'agent:main:r-cd-ra-revoked-visibility-parent-abc', target: 'agent:main:r-cd-ra-revoked-visibility-target-abc', ops: null },
    reason_hash: 'abcdef0123456789',
    reason_length: 120,
    delegate_mode: 'silent',
    target_primed: true,
    dispatch: { status: 'scheduled', accepted: true, observed_at_ms: 1_000 },
    child: { spawned: true, bound: true, done: true },
    transition: { method: 'session.visibility.set', ok: true, requested_at_ms: 5_000, settled_at_ms: 5_100 },
    probe_ran: true,
    target_obs: { ackRuns: 0, foreignRuns: 0, unattributedAssistantRows: 0, returnMarkerRows: 0, probeReplied: true, adoptedDeliveryRows: 0 },
    parent_ack_rows: 0,
    refusals: [],
    preflight: { ok: true },
  };
}

function revokedHarness(evidence) {
  const { target, parent } = evidence.keys;
  return {
    logEntries: [
      { atMs: 3_000, text: `[continuation:targeted-return] Delivered to ${target} from agent:main:subagent:c`, generation: 0 },
      { atMs: 4_000, text: `session event delivery skipped: recipient authority changed sessionKey=${parent} queueId=q-0`, generation: 0 },
      { atMs: 60_000, text: `session event delivery skipped: recipient authority changed sessionKey=${target} queueId=q-1`, generation: 0 },
    ],
    timeline: [
      { atMs: 900, state: 'read', rows: [] },
      { atMs: 1_200, state: 'read', rows: [{ session_key: target, epoch: '11111111-1111-4111-8111-111111111111' }] },
      // The transition request and its advance land in the same sample window.
      { atMs: 5_000, state: 'read', rows: [{ session_key: target, epoch: '22222222-2222-4222-8222-222222222222' }] },
      { atMs: 5_200, state: 'read', rows: [{ session_key: target, epoch: '22222222-2222-4222-8222-222222222222' }] },
    ],
  };
}

test('the control assembles a case record from scenario evidence, product log lines and the epoch timeline', () => {
  const evidence = revokedEvidence();
  const harness = revokedHarness(evidence);
  const record = assembleCaseRecord({
    caseId: 'revoked-visibility',
    runId: RUN,
    docsSha: 'd'.repeat(40),
    gates: completeRecord('allowed').gates,
    evidence,
    ...harness,
    generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }],
    cleanup: { gatewayStopped: true, residue: false },
    startedAtMs: 500,
  });
  assert.equal(record.park.deliveredToTargetAtMs, 3_000);
  assert.deepEqual(record.reason, { kind: 'replay-authority-changed', observedAtMs: 60_000, generation: 0 }, 'the parent\'s line is another session');
  assert.notEqual(record.epochs.captured, record.epochs.afterTransition, 'the captured epoch is read before the transition');
  assert.equal(gradeRecipientAuthorityCase({ ...record, trace: { correlated: true } }).verdict, 'PASS-candidate');
  const publicText = JSON.stringify(record);
  for (const secret of [evidence.keys.target, evidence.keys.parent, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']) {
    assert.ok(!publicText.includes(secret), `public record leaks ${secret}`);
  }
  const noReason = assembleCaseRecord({ caseId: 'revoked-visibility', runId: RUN, docsSha: 'd'.repeat(40), gates: completeRecord('allowed').gates, evidence, logEntries: harness.logEntries.slice(0, 2), timeline: harness.timeline, generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }], cleanup: { gatewayStopped: true, residue: false }, startedAtMs: 500 });
  assert.equal(noReason.reason, null);
  assert.equal(gradeRecipientAuthorityCase({ ...noReason, trace: { correlated: true } }).verdict, 'MISSING-candidate');
});

test('a sample taken after the transition is never read as the captured epoch', () => {
  // allowed-across-reset where the reset (wrongly) advanced the epoch and no sample fell between
  // the scheduled toolResult and the reset request: the advanced epoch must not pass as captured.
  const target = 'agent:main:r-cd-ra-allowed-across-reset-target-abc';
  const evidence = {
    ...revokedEvidence(),
    case: 'allowed-across-reset',
    delegate_mode: 'silent-wake',
    keys: { parent: 'agent:main:r-cd-ra-allowed-across-reset-parent-abc', target, ops: null },
    transition: { method: 'sessions.reset', ok: true, requested_at_ms: 1_500, settled_at_ms: 1_600 },
    probe_ran: false,
    target_obs: { ackRuns: 1, foreignRuns: 1, unattributedAssistantRows: 0, returnMarkerRows: 0, probeReplied: false, adoptedDeliveryRows: 0 },
  };
  const advanced = '22222222-2222-4222-8222-222222222222';
  const record = assembleCaseRecord({
    caseId: 'allowed-across-reset',
    runId: RUN,
    docsSha: 'd'.repeat(40),
    gates: completeRecord('allowed').gates,
    evidence,
    logEntries: [{ atMs: 1_200, text: `[continuation:targeted-return] Delivered to ${target} from agent:main:subagent:c`, generation: 0 }],
    timeline: [
      { atMs: 900, state: 'read', rows: [] },
      { atMs: 2_000, state: 'read', rows: [{ session_key: target, epoch: advanced }] },
      { atMs: 3_000, state: 'read', rows: [{ session_key: target, epoch: advanced }] },
    ],
    generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }],
    cleanup: { gatewayStopped: true, residue: false },
    startedAtMs: 500,
  });
  assert.equal(record.epochs.captured, null);
  const graded = gradeRecipientAuthorityCase({ ...record, trace: { correlated: true } });
  assert.equal(graded.verdict, 'MISSING-candidate');
  assert.ok(graded.missing.includes('captured-epoch-unread'));
});

test('case receipts are signed; a tampered or foreign-key receipt does not verify; --grade-row credits only matching traces', () => {
  const key = 'k'.repeat(40);
  const sealed = sealCaseReceipt(completeRecord('allowed'), key);
  assert.equal(verifyCaseReceipt(sealed, key), true);
  assert.equal(verifyCaseReceipt({ ...sealed, target: { ...sealed.target, ackRuns: 2 } }, key), false);
  assert.equal(verifyCaseReceipt(sealed, 'x'.repeat(40)), false);
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rra-grade-'));
  try {
    for (const caseId of RRA_CASE_IDS) {
      mkdirSync(path.join(dir, caseId));
      writeFileSync(path.join(dir, caseId, 'case-receipt.json'), JSON.stringify(sealCaseReceipt({ ...completeRecord(caseId), trace: null }, key)));
      const correlation = { schema: 'openclaw.k6.continuation-trace-correlation.v1', row: RRA_ROW, reason: { hash: 'abcdef0123456789', length: 120 }, traceId: TRACE_ID, traceJson: `tempo-trace-${TRACE_ID.slice(0, 12)}.json` };
      if (RRA_CASES[caseId].expectChild !== false) writeFileSync(path.join(dir, caseId, 'continuation-trace-correlation.json'), JSON.stringify(correlation));
    }
    assert.equal(gradeRowFromArtifacts(dir, key).verdict, 'PASS-candidate');
    writeFileSync(path.join(dir, 'allowed', 'continuation-trace-correlation.json'), JSON.stringify({ schema: 'openclaw.k6.continuation-trace-correlation.v1', row: RRA_ROW, reason: { hash: 'ffffffffffffffff', length: 120 }, traceId: TRACE_ID, traceJson: `tempo-trace-${TRACE_ID.slice(0, 12)}.json` }));
    assert.equal(gradeRowFromArtifacts(dir, key).verdict, 'PARTIAL-candidate', 'another case\'s trace is no trace');
    rmSync(path.join(dir, 'reassigned'), { recursive: true });
    assert.equal(gradeRowFromArtifacts(dir, key).verdict, 'MISSING-candidate');
    assert.equal(gradeRowFromArtifacts(dir, 'x'.repeat(40)).verdict, 'MISSING-candidate', 'nothing verifies under another key');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const good = { schema: 'openclaw.k6.continuation-trace-correlation.v1', row: RRA_ROW, reason: { hash: 'abcdef0123456789', length: 120 }, traceId: TRACE_ID, traceJson: `tempo-trace-${TRACE_ID.slice(0, 12)}.json` };
  assert.equal(traceCorrelationMatches(completeRecord('allowed'), good), true);
  assert.equal(traceCorrelationMatches(completeRecord('allowed'), { ...good, row: 'R-CD-4' }), false);
  assert.equal(traceCorrelationMatches(completeRecord('allowed'), { ...good, traceId: undefined }), false, 'no trace id, no trace');
  assert.equal(traceCorrelationMatches(completeRecord('allowed'), { ...good, traceJson: 'tempo-trace-000000000000.json' }), false, 'a trace file that is not its own');
});

test('the CLI fails closed with no target and refuses to grade without an observer key', () => {
  const run = (args) => spawnSync(process.execPath, [path.join(k6Root, 'scripts', 'run-recipient-authority-row.mjs'), ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: os.tmpdir() } });
  const bare = run([]);
  assert.equal(bare.status, 2);
  const refusal = JSON.parse(bare.stdout);
  for (const code of ['candidate-not-pinned', 'proof-gw-dir-invalid', 'observer-key-missing']) assert.ok(refusal.refusals.some((entry) => entry.code === code), code);
  const grade = run(['--grade-row', os.tmpdir()]);
  assert.equal(grade.status, 2);
  assert.throws(() => parseArgs(['node', 'x', '--cases', 'stale']), /unknown case/);
  assert.throws(() => parseArgs(['node', 'x', '--gateway-env', 'OPENCLAW_AGENT_DIR=/home/u/.openclaw']), /not allowed/);
  assert.deepEqual(parseArgs(['node', 'x', '--cases', 'replay-restart,allowed']).cases, ['allowed', 'replay-restart']);
});
