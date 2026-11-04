// R-CD-RECIPIENT-AUTHORITY: a live, isolated-gateway row (🌊's ruling, room msg
// 1567077062139838485; docs#536), pinned to the merged j12′ 1ab5a73e (msg 1567104742604406896;
// gate 3, msg 1567194866507841678). Registration, the live-run guard's refusal, the verdict rules
// over fixture receipts (each case, each missing observation is never PASS, each stage pinned),
// j12′'s refusal-line matchers (j12's lines never count), the continue_work case, the control's
// refusals and its public-safe, signed case receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  RRA_CASES,
  RRA_CASE_IDS,
  RRA_CASE_SCHEMA,
  RRA_J12,
  RRA_J12P,
  RRA_PINNED,
  RRA_PIN_STATUS,
  RRA_ROW,
  countDelegateCalls,
  countParentAcks,
  countRoutedAfter,
  countWorkCalls,
  evaluateContinuationConfig,
  evaluateModelSignIn,
  findDelegateDispatch,
  findOwnerAssignment,
  findReason,
  findReturnRefusals,
  findWorkElection,
  findWorkRefusals,
  gradeRecipientAuthorityCase,
  gradeRecipientAuthorityRow,
  isAdmissionPolicyRefusal,
  lineNamesKey,
  listenerOwnedBy,
  matchReasonLine,
  observeTargetTranscript,
  parseReturnRefusedLine,
  parseWorkRefusedLine,
  routedFromChild,
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
const COMP = `comp-${RRA_PINNED.slice(0, 8)}`;
/** The merged j12′ every record must name. */
const MERGED_J12P = '1ab5a73e14309922fa79edf4f93034bdb0acde62';
/** The refused chain e9dc1c31, the row's former interim pin: history, graded only, never fired. */
const INTERIM = 'e9dc1c318a2f73fd01755fc4682fa3349e8a0e94';
const WORK_CASE = 'work-revoked-visibility';
const sha256Hex = (value) => createHash('sha256').update(value).digest('hex');

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
  assert.equal(RRA_J12P, MERGED_J12P, 'pinned to the merged j12′');
  assert.equal(RRA_PINNED, RRA_J12P);
  assert.equal(manifest.invocation.pinnedCandidate, RRA_J12P);
  assert.equal(manifest.invocation.pinStatus, RRA_PIN_STATUS);
  assert.equal(RRA_PIN_STATUS, 'merged');
  assert.doesNotMatch(JSON.stringify(manifest), /INTERIM/, 'no interim pin left in the manifest');
  assert.equal(manifest.invocation.baselineCandidate, RRA_J12, 'j12 is the named baseline, never the pin');
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
  assert.match(docs, new RegExp(RRA_J12P));
  assert.doesNotMatch(docs, /INTERIM/);
  // The owner procedure stages, sets up and publishes at the merged head, never the interim pin.
  assert.match(docs, new RegExp(`proof-gw/comp-${MERGED_J12P.slice(0, 8)}`));
  assert.match(docs, new RegExp(`PROOFS/${MERGED_J12P}/R-CD-RECIPIENT-AUTHORITY/`));
  assert.match(docs, new RegExp(`--candidate ${MERGED_J12P}`));
  for (const stale of [`comp-${INTERIM.slice(0, 8)}`, `PROOFS/${INTERIM}`, `--candidate ${INTERIM}`]) assert.ok(!docs.includes(stale), stale);
  // The status line: every case MISSING until an owner runs it at the merged head.
  assert.match(docs, /^Status: \*\*catalogued, every case MISSING, never fired, in no corpus\.\*\*/m);
  assert.match(docs, /an owner runs it at `1ab5a73e`/);
  for (const caseId of RRA_CASE_IDS) assert.match(docs, new RegExp(`\`${caseId}\``), caseId);
  // The case table pins one stage per refused return.
  for (const caseId of RRA_CASE_IDS.filter((id) => ['return-refused', 'work-refused'].includes(RRA_CASES[id].reasonKind))) {
    assert.match(docs, new RegExp(`\\| \`${caseId}\` \\|[^\\n]*\`stage=${RRA_CASES[caseId].refusedAt}\``), caseId);
  }
  assert.match(docs, /## Operator procedure/);
  assert.match(docs, /5442236054/);
  const readme = readFileSync(path.join(k6Root, 'README.md'), 'utf8');
  const readmeLine = /^\| R-CD-RECIPIENT-AUTHORITY \| `run-recipient-authority-row\.mjs` \| [^\n]*$/m.exec(readme)?.[0] ?? '';
  assert.match(readmeLine, /j12′ 1ab5a73e/);
  assert.doesNotMatch(readmeLine, /interim/i);
  const readmeSection = /### R-CD-RECIPIENT-AUTHORITY [^\n]*\n[\s\S]*?(?=\n### )/.exec(readme)?.[0] ?? '';
  assert.match(readmeSection, new RegExp(MERGED_J12P));
  assert.doesNotMatch(readmeSection, /INTERIM/);
  const pipeline = readFileSync(path.join(k6Root, 'k6-proofs-pipeline.xml'), 'utf8');
  assert.match(pipeline, /<Row id="R-CD-RECIPIENT-AUTHORITY" [^>]*issue="docs#536"/);
  const pipelineRow = /<Row id="R-CD-RECIPIENT-AUTHORITY" [\s\S]*?<\/Row>/.exec(pipeline)?.[0] ?? '';
  assert.match(pipelineRow, /1ab5a73e1430/);
  assert.doesNotMatch(pipelineRow, /INTERIM|e9dc1c318a2f/);
  assert.match(pipelineRow, /work-revoked-visibility/);
  assert.match(pipeline, /<Manifest>tools\/k6-proofs\/manifests\/r-cd-recipient-authority\.json<\/Manifest>/);
});

test('the scenario header cites the j12′ product path at every boundary the verdict rests on', () => {
  const scenario = readFileSync(path.join(k6Root, 'scenarios', 'r-cd-recipient-authority.js'), 'utf8');
  assert.match(scenario, new RegExp(RRA_J12P));
  assert.doesNotMatch(scenario, /INTERIM/);
  // Every anchor re-walked at the merged j12′: files it did not change keep their lines; the
  // refusal path and the continue_work binding are j12′'s own.
  for (const anchor of [
    'src/config/sessions/session-recipient-authority-types.ts:96-101',
    'src/config/sessions/session-recipient-authority.worker.ts:36-56',
    'src/auto-reply/continuation/delegate-flow-store.ts:426-437',
    'src/config/sessions/session-accessor.sqlite-entry-store.ts:56-69',
    'session-accessor.sqlite-owner.ts:158-182',
    'session-accessor.sqlite-entry-mutation.ts:119-136',
    'session-sharing-store.native.ts:150-195',
    'src/agents/tools/continue-delegate-tool.ts:353-362',
    'src/auto-reply/continuation/delegate-dispatch.ts:267-290',
    'src/auto-reply/continuation/return-refusal.ts:16-36',
    'src/auto-reply/continuation/return-refusal.ts:38-46',
    'src/agents/subagent-announce.continuation-return.ts:98-215',
    'src/auto-reply/continuation/targeting.ts:249-411',
    'src/auto-reply/continuation/continuation-wake.ts:127-256',
    'src/auto-reply/reply/session-system-events.ts:192-207',
    'src/gateway/server-restart-sentinel-delivery.ts:263-281',
    'src/infra/session-delivery-queue-recovery.ts:152-215',
    'src/infra/delivery-queue-sqlite.kernel.ts:397-429',
    'src/auto-reply/reply/session-reset-cleanup.ts:149-227, consumed at :202-203',
    'src/cli/gateway-cli/run-loop.ts:496-551',
    'src/auto-reply/continuation/work-dispatch.ts:631-740',
    'work-dispatch.ts:529 -> work-recipient-authority.ts',
    'src/auto-reply/reply/agent-runner-continuation-signal.ts:463',
  ]) {
    assert.ok(scenario.includes(anchor), anchor);
  }
  // j12's anchors for the files j12′ changed, and the interim pin's for the files the merge moved, are gone.
  for (const stale of [
    'targeting.ts:240-254', 'continuation-wake.ts:127-238', 'server-restart-sentinel-delivery.ts:226-243', 'session event delivery skipped',
    'session-recipient-authority-types.ts:87-92', 'session-recipient-authority.worker.ts:35-50', 'return-refusal.ts:15-29',
    'session-reset-cleanup.ts:146-196', 'consumed at :194-196',
  ]) {
    assert.ok(!scenario.includes(stale), stale);
  }
});

test('live-run-guard refuses the row even with every live-run variable set', () => {
  for (const env of [{}, { OPENCLAW_GATEWAY_TOKEN: 'x'.repeat(32), OPENCLAW_SESSION_KEY: 'agent:main:main', OPENCLAW_CANDIDATE_SHA: RRA_PINNED }]) {
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
    candidateSha: RRA_PINNED,
    docsSha: 'd'.repeat(40),
    gates: {
      candidatePinned: true,
      buildInfoCommit: RRA_PINNED,
      stateIsolated: true,
      modelSignIn: true,
      crossSessionTargetingEnabled: true,
      gatewayStartedByHarness: true,
    },
    gateway: { generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }], restartedAtMs: null },
    scenario: { controlRunId: RUN, refusals: [], preflightOk: true },
    dispatch: { accepted: true, status: 'scheduled', capturedAtMs: 1000, reasonHash: 'abcdef0123456789', reasonLength: 120, delegateMode: spec.mode, resultMode: spec.mode, resultDelaySeconds: 30, otherDelegateCalls: 0 },
    child: { spawned: true, bound: true, done: true },
    target: {
      primed: true,
      probeRan: refusal,
      probeSentAtMs: refusal ? 59_000 : null,
      probeReplied: refusal,
      ackRuns: refusal ? 0 : 1,
      foreignRuns: refusal ? 0 : 1,
      unattributedAssistantRows: 0,
      returnMarkerRows: 0,
      adoptedDeliveryRows: 0,
    },
    parent: { ackRows: 0 },
    preTransition: durable ? { ackRuns: 0, foreignRuns: 0, adoptedDeliveryRows: 0 } : null,
    transition: { method: spec.transition, ok: spec.transition ? true : null, requestedAtMs: spec.transition ? 5000 : null, settledAtMs: spec.transition ? 5100 : null },
    // A parked return was routed before its transition; a wake-mode one never was.
    park: { deliveredToTargetAtMs: spec.timing === 'before-return' ? null : 4000 },
    routing: durable ? { duringTransition: 0, afterTransition: 0 } : null,
    epochs: { captured: H('a'), afterTransition: spec.transition ? (durable ? H('b') : H('a')) : null, final: durable ? H('b') : H('a') },
    reason: durable ? refusedReason(spec, { observedAtMs: 60000, generation: 0 }) : null,
    config: null,
    trace: spec.expectChild === false ? null : { correlated: true },
    cleanup: { gatewayStopped: true, residue: false },
  };
  if (spec.probeAdopts) {
    // The probe turn adopts the parked silent return: the product's marker on its row. The model
    // answers the probe as asked; an ack is not required of it.
    record.target = { ...record.target, probeRan: true, probeReplied: true, ackRuns: 0, foreignRuns: 0, adoptedDeliveryRows: 1 };
  }
  if (caseId === 'unauthorized-admission') {
    record.dispatch = { accepted: false, status: 'error', capturedAtMs: null, reasonHash: 'abcdef0123456789', reasonLength: 120, delegateMode: spec.mode, resultMode: null, resultDelaySeconds: null, otherDelegateCalls: 0 };
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
    record.reason = refusedReason(spec, { observedAtMs: 9000, generation: 1 });
  }
  if (spec.tool === 'continue_work') {
    // The session elects its own wake (scheduled result at 1 s, captured at 1.5-2 s), narrows its own
    // visibility at 5 s, is refused at the handoff at 32 s and probed at 50 s. No parent, child,
    // router line or trace.
    record.keys = { parent: null };
    record.dispatch = { accepted: true, status: 'scheduled', capturedAtMs: 1000, reasonHash: 'abcdef0123456789', reasonLength: 140, delegateMode: null, resultMode: null, resultDelaySeconds: 30, otherDelegateCalls: 0, otherWorkCalls: 0 };
    record.child = { spawned: null, bound: false, done: false };
    record.target = { ...record.target, probeSentAtMs: 50_000 };
    record.parent = { ackRows: null };
    record.preTransition = { ackRuns: 0, foreignRuns: 0, adoptedDeliveryRows: 0 };
    record.park = { deliveredToTargetAtMs: null };
    record.routing = null;
    record.epochs = { captured: H('a'), capturedAfterMs: 1500, capturedByMs: 2000, afterTransition: H('b'), final: H('b') };
    record.reason = { kind: 'work-refused', stage: 'wake', stages: ['wake'], reasonTexts: ['recipient-authority-changed'], observedAtMs: 32_000, generation: 0, flowIdHash: H('f'), distinctFlowIds: 1, lines: 1 };
    record.trace = null;
  }
  return record;
}

/** The control's reason for a refused return: its j12′ line at the case's pinned stage. */
function refusedReason(spec, { observedAtMs, generation }) {
  return {
    kind: 'return-refused',
    stage: spec.refusedAt,
    stages: [spec.refusedAt],
    reasonTexts: ['recipient-authority-changed'],
    observedAtMs,
    generation,
    deliveryIdHash: spec.deliveryId ? H('e') : null,
    distinctDeliveryIds: spec.deliveryId ? 1 : 0,
    linesWithoutDeliveryId: spec.deliveryId ? 0 : 1,
    lines: 1,
  };
}

const mutate = (record, fn) => {
  const copy = structuredClone(record);
  fn(copy);
  return copy;
};
// The delegate cases; the one continue_work case has its own rules and tests below.
const refusalCases = RRA_CASE_IDS.filter((caseId) => RRA_CASES[caseId].family === 'refusal' && !RRA_CASES[caseId].tool);
const allowedCases = RRA_CASE_IDS.filter((caseId) => RRA_CASES[caseId].family === 'allowed');
const durableCases = refusalCases.filter((caseId) => RRA_CASES[caseId].expectChild !== false);
const parkedCases = durableCases.filter((caseId) => RRA_CASES[caseId].timing === 'parked');
const wakeModeCases = durableCases.filter((caseId) => RRA_CASES[caseId].timing === 'before-return');

test('every case with its complete receipt chain grades PASS-candidate', () => {
  assert.deepEqual(RRA_CASE_IDS, [
    'allowed', 'allowed-across-reset', 'allowed-silent', 'unauthorized-admission', 'unauthorized-dispatch',
    'revoked-visibility', 'revoked-membership', 'revoked-owner', 'reassigned', 'wake-revoked-visibility',
    'wake-reassigned', 'work-revoked-visibility', 'replay-restart',
  ]);
  // The twelve delegate cases keep their grouping; the continue_work case is the one addition.
  assert.equal(refusalCases.length + allowedCases.length, 12);
  assert.deepEqual(RRA_CASE_IDS.filter((caseId) => RRA_CASES[caseId].tool), [WORK_CASE]);
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
  for (const caseId of parkedCases) {
    const late = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.park.deliveredToTargetAtMs = 5000; }));
    assert.ok(late.missing.includes('return-not-parked-before-transition'), caseId);
    assert.equal(late.verdict, 'MISSING-candidate');
    const unrouted = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.park.deliveredToTargetAtMs = null; }));
    assert.equal(unrouted.verdict, 'MISSING-candidate', caseId);
  }
  for (const caseId of durableCases) {
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

test('each refused return pins one stage from the j12′ bytes, and a row only where that stage writes one', () => {
  assert.deepEqual(
    Object.fromEntries(durableCases.map((caseId) => [caseId, [RRA_CASES[caseId].refusedAt, RRA_CASES[caseId].deliveryId, RRA_CASES[caseId].timing, RRA_CASES[caseId].mode]])),
    {
      'revoked-visibility': ['prompt-drain', true, 'parked', 'silent'],
      'revoked-membership': ['prompt-drain', true, 'parked', 'silent'],
      'revoked-owner': ['prompt-drain', true, 'parked', 'silent'],
      reassigned: ['replay', true, 'parked', 'silent'],
      'wake-revoked-visibility': ['enqueue', false, 'before-return', 'silent-wake'],
      'wake-reassigned': ['enqueue', false, 'before-return', 'silent-wake'],
      'replay-restart': ['replay', true, 'parked', 'silent'],
    },
  );
  assert.deepEqual(
    Object.fromEntries(durableCases.map((caseId) => [caseId, RRA_CASES[caseId].laterStages ?? []])),
    {
      'revoked-visibility': ['replay'], 'revoked-membership': ['replay'], 'revoked-owner': ['replay'],
      reassigned: [], 'wake-revoked-visibility': [], 'wake-reassigned': [], 'replay-restart': [],
    },
    'only a prompt-drain refusal can be followed by the sweep reporting the same row',
  );
  for (const caseId of durableCases) {
    const spec = RRA_CASES[caseId];
    assert.match(spec.refusedAtBytes, /\.ts:\d+/u, caseId);
    // Any other stage is never PASS: the case's claim is the pinned boundary.
    for (const stage of ['enqueue', 'replay', 'wake', 'prompt-drain'].filter((value) => value !== spec.refusedAt)) {
      const graded = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.reason.stage = stage; r.reason.stages = [stage]; }));
      assert.equal(graded.verdict, 'MISSING-candidate', `${caseId} at ${stage}`);
      assert.ok(graded.missing.includes('refusal-stage-mismatch'), `${caseId} at ${stage}`);
    }
    const mixed = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.reason.stages = [spec.refusedAt, 'wake']; r.reason.lines = 2; }));
    assert.ok(mixed.missing.includes('refusal-stage-mismatch'), caseId);
    // The first line decides: a pinned stage seen only later is not the boundary that refused it.
    const latePin = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.reason.stage = 'wake'; r.reason.stages = ['wake', spec.refusedAt]; }));
    assert.ok(latePin.missing.includes('refusal-stage-mismatch'), caseId);
    // A row named where the stage writes none, or none named where it does.
    const flipped = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => {
      r.reason.deliveryIdHash = spec.deliveryId ? null : H('e');
      r.reason.distinctDeliveryIds = spec.deliveryId ? 0 : 1;
    }));
    assert.equal(flipped.verdict, 'MISSING-candidate', caseId);
    assert.ok(flipped.missing.includes('refusal-delivery-id-mismatch'), caseId);
    // The disposable target receives one return: two refused rows are not this case's alone.
    const twoRows = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.reason.distinctDeliveryIds = 2; }));
    assert.ok(twoRows.missing.includes('reason-delivery-id-ambiguous'), caseId);
    const unreadIds = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.reason.distinctDeliveryIds = undefined; }));
    assert.ok(unreadIds.missing.includes('reason-delivery-id-ambiguous'), caseId);
    // Exactly: a row-writing stage names its row on every line; a row-less one names none on any.
    const inexact = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => {
      if (spec.deliveryId) r.reason.linesWithoutDeliveryId = 1;
      else r.reason.distinctDeliveryIds = 1;
      r.reason.lines = 2;
    }));
    assert.ok(inexact.missing.includes('reason-delivery-id-ambiguous'), caseId);
    // Every line carries j12′'s one reason.
    for (const texts of [['other-reason'], ['recipient-authority-changed', 'other-reason'], [], undefined]) {
      const reasonText = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.reason.reasonTexts = texts; }));
      assert.ok(reasonText.missing.includes('refusal-reason-mismatch'), `${caseId} ${JSON.stringify(texts)}`);
    }
    // A later line at a stage the bytes name for the same row is allowed; any other is not.
    for (const stage of ['enqueue', 'replay', 'wake', 'prompt-drain'].filter((value) => value !== spec.refusedAt)) {
      const later = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.reason.stages = [spec.refusedAt, stage]; r.reason.lines = 2; }));
      assert.equal(later.verdict, (spec.laterStages ?? []).includes(stage) ? 'PASS-candidate' : 'MISSING-candidate', `${caseId} then ${stage}`);
    }
    // j12's reason kind is not j12′'s.
    const j12Kind = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.reason.kind = 'replay-authority-changed'; }));
    assert.ok(j12Kind.missing.includes('refusal-reason-not-observed'), caseId);
    // A Delivered to line for the return after its transition is FAIL; an unread router log is MISSING.
    const routed = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.routing.afterTransition = 1; }));
    assert.equal(routed.verdict, 'FAIL-candidate', caseId);
    assert.ok(routed.contradictions.includes('refused-return-routed'), caseId);
    const during = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.routing.duringTransition = 1; r.target.ackRuns = 1; }));
    assert.equal(during.verdict, 'MISSING-candidate', caseId);
    assert.ok(during.missing.includes('return-routed-during-transition'), caseId);
    assert.deepEqual(during.contradictions, [], caseId);
    for (const routing of [null, { afterTransition: null, duringTransition: 0 }, { afterTransition: 0, duringTransition: null }, {}]) {
      const unread = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.routing = routing; }));
      assert.equal(unread.verdict, 'MISSING-candidate', `${caseId} ${JSON.stringify(routing)}`);
      assert.ok(unread.missing.includes('routing-unread'), caseId);
    }
  }
  // Only the prompt-drain cases bind the reason to the probe turn's drain.
  for (const caseId of durableCases) {
    const early = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.probeSentAtMs = 61_000; }));
    if (RRA_CASES[caseId].refusedAt === 'prompt-drain') {
      assert.equal(early.verdict, 'MISSING-candidate', caseId);
      assert.ok(early.missing.includes('reason-not-from-probe-drain'), caseId);
    } else {
      assert.equal(early.verdict, 'PASS-candidate', caseId);
    }
    if (RRA_CASES[caseId].refusedAt === 'prompt-drain') {
      const unsent = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.probeSentAtMs = null; }));
      assert.ok(unsent.missing.includes('reason-not-from-probe-drain'), caseId);
    }
  }
});

test('a wake-mode refusal: transitioned before the fire, never routed, refused at enqueue with no row', () => {
  for (const caseId of wakeModeCases) {
    // The transition must settle before the delegate could fire, or the return may have been current.
    for (const fn of [
      (r) => { r.transition.settledAtMs = 31_500; },
      (r) => { r.dispatch.resultDelaySeconds = 2; },
      (r) => { r.dispatch.resultDelaySeconds = null; },
      (r) => { r.transition.settledAtMs = null; },
    ]) {
      const late = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { fn(r); r.target.ackRuns = 1; r.target.foreignRuns = 1; }));
      assert.equal(late.verdict, 'MISSING-candidate', caseId);
      assert.ok(late.missing.includes('transition-not-before-fire'), `${caseId}: ${late.missing}`);
      assert.deepEqual(late.contradictions, [], `${caseId}: a return current at its routing may be adopted`);
    }
    // Routed before the transition: it was delivered while current, so its adoption proves nothing.
    const beat = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => {
      r.park.deliveredToTargetAtMs = 4_000;
      r.target.ackRuns = 1;
      r.target.foreignRuns = 1;
    }));
    assert.equal(beat.verdict, 'MISSING-candidate', caseId);
    assert.ok(beat.missing.includes('return-routed-before-transition'));
    assert.deepEqual(beat.contradictions, []);
    // Routed after it: the router delivered a return whose authority had already advanced.
    const routed = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => {
      r.park.deliveredToTargetAtMs = 40_000;
      r.routing.afterTransition = 1;
    }));
    assert.equal(routed.verdict, 'FAIL-candidate', caseId);
    assert.ok(routed.contradictions.includes('refused-return-routed'));
    // A wake turn on the target is FAIL, as for every refusal.
    const woken = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.foreignRuns = 1; }));
    assert.equal(woken.verdict, 'FAIL-candidate', caseId);
    assert.ok(woken.contradictions.includes('target-woken'));
    // A parked case keeps requiring its park; a wake-mode case never needs one.
    assert.equal(gradeRecipientAuthorityCase(completeRecord(caseId)).missing.includes('return-not-parked-before-transition'), false);
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
      ...(RRA_CASES[caseId].probeAdopts ? {} : { 'allowed-return-not-adopted': (r) => { r.target.ackRuns = 0; r.target.foreignRuns = 0; } }),
      'duplicate-adoption': (r) => { r.target.ackRuns = 2; },
      'duplicate-adoption (two marked rows)': (r) => { r.target.adoptedDeliveryRows = 2; },
      'duplicate-wake': (r) => { r.target.foreignRuns = 2; },
      'return-landed-in-parent': (r) => { r.parent.ackRows = 1; },
      'adopted-after-epoch-advance': (r) => { r.epochs.final = H('c'); r.target.ackRuns = Math.max(r.target.ackRuns, 1); },
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
    if (!RRA_CASES[caseId].probeAdopts) {
      // Woken but without the exact ack may be the model's miss, never the product's: MISSING.
      const loose = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.ackRuns = 0; }));
      assert.equal(loose.verdict, 'MISSING-candidate', caseId);
      assert.ok(loose.missing.includes('woken-without-ack'), caseId);
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

test('a record not about j12′ on a harness-owned gateway is MISSING whatever else it shows', () => {
  const adoptedRefusal = (r) => { r.target.ackRuns = 1; };
  for (const [label, fn] of Object.entries({
    'candidate-not-pinned': (r) => { r.candidateSha = 'f15237ec921879d918482cdf372b0718d4c1aab9'; },
    'candidate-not-pinned (the j12 baseline)': (r) => { r.candidateSha = RRA_J12; },
    'candidate-not-pinned (the interim pin)': (r) => { r.candidateSha = INTERIM; },
    'gate:buildInfoCommit': (r) => { r.gates.buildInfoCommit = 'f15237ec921879d918482cdf372b0718d4c1aab9'; },
    'gate:buildInfoCommit (a j12 stage)': (r) => { r.gates.buildInfoCommit = RRA_J12; },
    'gate:buildInfoCommit (an interim stage)': (r) => { r.gates.buildInfoCommit = INTERIM; },
    'gateway-not-harness-owned': (r) => { r.gateway.generations[0].ownedListenerThroughout = false; },
    'gateway-not-harness-owned (none)': (r) => { r.gateway.generations = []; },
    'scenario-not-bound-to-run': (r) => { r.scenario.controlRunId = 'rra-ffffffffffffffff'; },
    ...Object.fromEntries(['candidatePinned', 'stateIsolated', 'modelSignIn', 'crossSessionTargetingEnabled', 'gatewayStartedByHarness']
      .map((key) => [`gate:${key}`, (r) => { r.gates[key] = 'true'; }])),
  })) {
    const graded = gradeRecipientAuthorityCase(mutate(completeRecord('revoked-visibility'), (r) => { fn(r); adoptedRefusal(r); }));
    assert.equal(graded.verdict, 'MISSING-candidate', label);
    assert.ok(graded.missing.includes(label.replace(/ \(.*\)$/u, '')), `${label}: ${graded.missing}`);
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

test('a deviation by the model or the setup is MISSING, never a product FAIL', () => {
  const adoptedEverything = (r) => {
    r.target.ackRuns = 1;
    r.target.foreignRuns = 1;
    r.target.adoptedDeliveryRows = 1;
    r.child.spawned = true;
  };
  const deviations = {
    'extra-delegate-calls': (r) => { r.dispatch.otherDelegateCalls = 1; },
    'delegate-calls-unread': (r) => { r.dispatch.otherDelegateCalls = null; },
    'scenario-refused': (r) => { r.scenario.refusals = ['websocket error']; },
    'preflight-not-ok': (r) => { r.scenario.preflightOk = false; },
  };
  for (const caseId of [...refusalCases, ...allowedCases]) {
    for (const [code, fn] of Object.entries(deviations)) {
      const graded = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { fn(r); adoptedEverything(r); }));
      assert.equal(graded.verdict, 'MISSING-candidate', `${caseId} ${code}: ${JSON.stringify(graded)}`);
      assert.ok(graded.missing.includes(code), `${caseId} ${code}`);
      assert.deepEqual(graded.contradictions, [], `${caseId} ${code}`);
    }
  }
  for (const caseId of [...durableCases, ...allowedCases, 'unauthorized-dispatch']) {
    const wrongMode = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => {
      r.dispatch.resultMode = RRA_CASES[caseId].mode === 'silent' ? 'silent-wake' : 'normal';
      adoptedEverything(r);
    }));
    assert.equal(wrongMode.verdict, 'MISSING-candidate', caseId);
    assert.ok(wrongMode.missing.includes('delegate-shape-mismatch'), caseId);
    assert.deepEqual(wrongMode.contradictions, [], caseId);
  }
  // unauthorized-dispatch: the policy must change before the delegate can fire.
  for (const delay of [0, 1, null]) {
    const early = gradeRecipientAuthorityCase(mutate(completeRecord('unauthorized-dispatch'), (r) => { r.dispatch.resultDelaySeconds = delay; r.child.spawned = true; }));
    assert.equal(early.verdict, 'MISSING-candidate', String(delay));
    assert.ok(early.missing.includes('policy-change-not-before-fire'));
  }
  // A revoked return already adopted or woken before its transition was a current return.
  for (const caseId of durableCases) {
    for (const key of ['ackRuns', 'foreignRuns', 'adoptedDeliveryRows']) {
      const early = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.preTransition[key] = 1; adoptedEverything(r); }));
      assert.equal(early.verdict, 'MISSING-candidate', `${caseId} ${key}`);
      assert.ok(early.missing.includes('return-not-parked-unadopted'));
      assert.deepEqual(early.contradictions, []);
    }
    const unread = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.preTransition = null; }));
    assert.ok(unread.missing.includes('pre-transition-unread'), caseId);
  }
});

test('allowed-silent is the control for the refusal cases\' absence: the product marker must show', () => {
  const unseen = gradeRecipientAuthorityCase(mutate(completeRecord('allowed-silent'), (r) => { r.target.adoptedDeliveryRows = 0; }));
  assert.equal(unseen.verdict, 'MISSING-candidate');
  assert.ok(unseen.missing.includes('adoption-marker-unobserved'));
  // The model answering the probe as asked, without any ack, is a PASS: the product's marker decides.
  assert.equal(gradeRecipientAuthorityCase(completeRecord('allowed-silent')).verdict, 'PASS-candidate');
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

const DELIVERY_ID = 'a1b2c3d4'.repeat(8);
/** j12′'s refused-return line as the console prints it (src/logging/subsystem.ts:158-194). */
const refusedConsole = (stage, key, deliveryId = DELIVERY_ID) =>
  `08:00:00.000 [continuation/return-refused] [continuation:return-refused] stage=${stage} reason=recipient-authority-changed session=${key}${deliveryId ? ` deliveryId=${deliveryId}` : ''}`;
/** The same line in the structured file log: tslog's [name, meta, message] (src/logging/subsystem.ts:317-330). */
const refusedFile = (stage, key, deliveryId = DELIVERY_ID, meta = {}) => {
  const message = `[continuation:return-refused] stage=${stage} reason=recipient-authority-changed session=${key}${deliveryId ? ` deliveryId=${deliveryId}` : ''}`;
  return JSON.stringify({
    0: JSON.stringify({ subsystem: 'continuation/return-refused' }),
    1: { stage, reason: 'recipient-authority-changed', sessionKey: key, ...(deliveryId ? { deliveryId } : {}), ...meta },
    2: message,
    _meta: { logLevelName: 'WARN', name: JSON.stringify({ subsystem: 'continuation/return-refused' }) },
    time: '2026-11-03T08:00:00.000Z',
  });
};
/** j12's replay warn, which j12′ removed. */
const j12ReplayLine = (key) => `2026-11-03T08:00:00.000Z [gateway/restart-sentinel] session event delivery skipped: recipient authority changed sessionKey=${key} queueId=q-1`;

test('j12′\'s refused-return line is read from the console or the structured file log; j12\'s lines never count', () => {
  const target = 'agent:main:r-cd-ra-revoked-visibility-target-abc';
  for (const stage of ['enqueue', 'replay', 'wake', 'prompt-drain']) {
    for (const line of [refusedConsole(stage, target), refusedFile(stage, target), `\u001b[90m08:00:00\u001b[39m \u001b[35m[continuation/return-refused]\u001b[39m \u001b[33m[continuation:return-refused] stage=${stage} reason=recipient-authority-changed session=${target} deliveryId=${DELIVERY_ID}\u001b[39m`]) {
      assert.deepEqual(parseReturnRefusedLine(line), { stage, reason: 'recipient-authority-changed', session: target, deliveryId: DELIVERY_ID }, line);
      assert.equal(matchReasonLine(line, 'return-refused', { targetKey: target }), true, line);
    }
  }
  // The router's first read refuses before any row: no deliveryId.
  assert.deepEqual(parseReturnRefusedLine(refusedConsole('enqueue', target, null)), { stage: 'enqueue', reason: 'recipient-authority-changed', session: target, deliveryId: null });
  assert.deepEqual(parseReturnRefusedLine(refusedFile('enqueue', target, null)), { stage: 'enqueue', reason: 'recipient-authority-changed', session: target, deliveryId: null });
  // A JSON console line (style json) carries the subsystem and message as fields.
  const jsonConsole = JSON.stringify({ time: '2026-11-03T08:00:00.000Z', level: 'warn', subsystem: 'continuation/return-refused', message: `[continuation:return-refused] stage=replay reason=recipient-authority-changed session=${target} deliveryId=${DELIVERY_ID}`, stage: 'replay', sessionKey: target, deliveryId: DELIVERY_ID });
  assert.equal(parseReturnRefusedLine(jsonConsole)?.stage, 'replay');
  // j12's lines, in either form, are not j12′'s reason.
  const j12Wake = `session event delivery wake skipped: recipient authority changed sessionKey=${target} queueId=q-1`;
  const j12File = JSON.stringify({ 0: '{"subsystem":"gateway/restart-sentinel"}', 1: { sessionKey: target, queueId: 'q-1' }, 2: 'session event delivery skipped: recipient authority changed' });
  for (const line of [j12ReplayLine(target), j12Wake, j12File]) {
    assert.equal(parseReturnRefusedLine(line), null, line);
    assert.equal(matchReasonLine(line, 'return-refused', { targetKey: target }), false, line);
  }
  // Only the product's own text: another subsystem, a trailing remainder, a disagreeing field, an
  // assistant quoting it, another reason or another session do not count.
  const message = `[continuation:return-refused] stage=replay reason=recipient-authority-changed session=${target} deliveryId=${DELIVERY_ID}`;
  for (const line of [
    `[agent/embedded] ${message}`,
    `assistant said: ${message}`,
    // The subsystem tag must open the line (after at most a timestamp), not be quoted inside it.
    `08:00:00 [agent/embedded] assistant text: [continuation/return-refused] ${message}`,
    // A JSON record of another subsystem that merely carries the tag as a value.
    JSON.stringify({ subsystem: 'agent/embedded', quoted: JSON.stringify({ subsystem: 'continuation/return-refused' }), message }),
    JSON.stringify({ 0: '{"subsystem":"agent/embedded"}', 1: JSON.stringify({ subsystem: 'continuation/return-refused' }), 2: message }),
    `${refusedConsole('replay', target)} extra`,
    refusedFile('replay', target, DELIVERY_ID, { stage: 'wake' }),
    refusedFile('replay', target, DELIVERY_ID, { sessionKey: `${target}2` }),
    JSON.stringify({ 0: '{"subsystem":"agent/embedded"}', 2: message }),
    '{not json [continuation:return-refused]',
  ]) {
    assert.equal(parseReturnRefusedLine(line), null, line);
  }
  assert.equal(matchReasonLine(refusedConsole('replay', target).replace('recipient-authority-changed', 'other-reason'), 'return-refused', { targetKey: target }), false);
  assert.equal(matchReasonLine(refusedConsole('replay', `${target}2`), 'return-refused', { targetKey: target }), false, 'a longer key is another session');
  assert.equal(matchReasonLine(refusedConsole('replay', target), 'return-refused', { targetKey: `${target}x` }), false);
  assert.equal(matchReasonLine(refusedConsole('replay', target), 'return-refused', {}), false, 'no target, no match');
  // findReturnRefusals keeps every line for the target from afterMs on, in order, with stage and id.
  const entries = [
    { atMs: 10, text: refusedConsole('replay', target) },
    { atMs: 20, text: refusedConsole('prompt-drain', 'agent:main:other') },
    { atMs: 30, text: refusedFile('prompt-drain', target), generation: 1 },
    { atMs: 40, text: j12ReplayLine(target) },
  ];
  assert.deepEqual(findReturnRefusals(entries, target, 20).map(({ atMs, stage, generation }) => [atMs, stage, generation]), [[30, 'prompt-drain', 1]]);
  assert.equal(findReturnRefusals(entries, target).length, 2);
  // The cross-session policy reasons are unchanged at j12′.
  const parent = 'agent:main:r-cd-ra-unauthorized-dispatch-parent-abc';
  const rejected = `[continuation:delegate-rejected] policy.cross_session_targeting task=RCDRA:x session=${parent}`;
  assert.equal(matchReasonLine(rejected, 'dispatch-policy', { parentKey: parent }), true);
  assert.equal(matchReasonLine(rejected, 'dispatch-policy', { parentKey: target }), false);
  assert.equal(matchReasonLine(rejected, 'admission-policy', { parentKey: parent }), false, 'admission reasons come from the toolResult');
  assert.equal(lineNamesKey(`a=${target} b`, target), true);
  assert.equal(lineNamesKey(`a=${target}:child b`, target), false);
  assert.equal(findReason([{ atMs: 10, text: rejected }, { atMs: 30, text: rejected, generation: 1 }], 'dispatch-policy', { parentKey: parent }, 20).generation, 1);
  assert.equal(findReason([{ atMs: 10, text: rejected }], 'dispatch-policy', { parentKey: parent }, 20), null);
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
  // j12 logged an empty list when every recipient was refused; j12′ logs nothing. Either way the
  // line is bound to the return by its child.
  const child = 'agent:main:subagent:c';
  assert.equal(routedFromChild(`[continuation:targeted-return] Delivered to  from ${child}`, child), true);
  assert.equal(routedFromChild(`[continuation:targeted-return] Delivered to ${target} from ${child}`, child), true);
  assert.equal(routedFromChild(`[continuation:targeted-return] Delivered to ${target} from ${child}2`, child), false);
  assert.equal(routedFromChild(`[continuation:targeted-return] Delivered to ${target} from ${child}`, null), false);
  // A JSON-wrapped console line ends the key with a quote or a brace.
  assert.equal(routedFromChild(JSON.stringify({ message: `[continuation:targeted-return] Delivered to  from ${child}` }), child), true);
  const lines = [
    { atMs: 10, text: `[continuation:targeted-return] Delivered to ${target} from ${child}` },
    { atMs: 30, text: `[continuation:targeted-return] Delivered to  from ${child}` },
    { atMs: 40, text: `[continuation:targeted-return] Delivered to agent:main:x from agent:main:subagent:other` },
  ];
  assert.equal(countRoutedAfter(lines, { targetKey: target, childKey: child }, 20), 1);
  assert.equal(countRoutedAfter(lines, { targetKey: target, childKey: null }, 0), 1);
  assert.equal(countRoutedAfter(lines, { targetKey: target, childKey: child }, 0), 2);
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
  assert.deepEqual(findDelegateDispatch([call('c1', { task, targetSessionKey: target }), result('c1', { status: 'scheduled', mode: 'silent', delaySeconds: 30 })], { taskMarker: 'RCDRA:abc', targetSessionKey: target }), { status: 'scheduled', toolCallId: 'c1', errorText: null, mode: 'silent', delaySeconds: 30 });
  assert.equal(countDelegateCalls([call('c1', { task, targetSessionKey: target }), call('c2', { task, targetSessionKey: 'agent:main:x' }), say('x', 'r')]), 2);
  const refused = findDelegateDispatch([call('c2', { task, targetSessionKey: target }), result('c2', 'cross-session continuation targeting is disabled by agents.defaults.continuation.crossSessionTargeting.', true)], { taskMarker: 'RCDRA:abc', targetSessionKey: target });
  assert.equal(refused.status, 'error');
  assert.equal(isAdmissionPolicyRefusal(refused.errorText), true);
  assert.equal(findDelegateDispatch([call('c3', { task, targetSessionKey: 'agent:main:other' }), result('c3', { status: 'scheduled' })], { taskMarker: 'RCDRA:abc', targetSessionKey: target }), null);
  assert.equal(findDelegateDispatch([call('c4', { task: 'other', targetSessionKey: target }), result('c4', { status: 'scheduled' })], { taskMarker: 'RCDRA:abc', targetSessionKey: target }), null);
  assert.deepEqual(findDelegateDispatch([call('c5', { task, targetSessionKey: target })], { taskMarker: 'RCDRA:abc', targetSessionKey: target }), { status: null, toolCallId: 'c5', errorText: null, mode: null, delaySeconds: null });
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
  const stateDir = `/home/u/proof-gw/${COMP}/state`;
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
  const reloadOff = evaluateContinuationConfig({ gateway: { reload: { mode: 'off' } }, agents: { defaults: { continuation: { enabled: true, crossSessionTargeting: 'enabled' } } } });
  assert.ok(reloadOff.refusals.some((entry) => entry.code === 'config-reload-off'), 'a policy patch would never apply');
  assert.equal(listenerOwnedBy({ pid: 10, startTicks: 5 }, { pid: 10, startTicks: 5 }), true);
  assert.equal(listenerOwnedBy({ pid: 10, startTicks: 6 }, { pid: 10, startTicks: 5 }), false, 'a recycled PID is another process');
  assert.equal(listenerOwnedBy({ pid: 11, startTicks: 5 }, { pid: 10, startTicks: 5 }), false);
  assert.equal(listenerOwnedBy(null, { pid: 10, startTicks: 5 }), false);
});

function proofGwFixture({ buildCommit = RRA_PINNED, crossSession = 'enabled', stateLink = false } = {}) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'rra-home-'));
  const dir = path.join(home, 'proof-gw', COMP);
  const stage = path.join(home, 'stage');
  mkdirSync(path.join(dir, 'receipts'), { recursive: true });
  mkdirSync(path.join(home, '.openclaw'), { recursive: true });
  if (stateLink) symlinkSync(path.join(home, '.openclaw'), path.join(dir, 'state'));
  else mkdirSync(path.join(dir, 'state'));
  mkdirSync(path.join(stage, 'dist'), { recursive: true });
  writeFileSync(path.join(stage, 'dist', 'build-info.json'), JSON.stringify({ commit: buildCommit, buildId: 'b' }));
  writeFileSync(path.join(stage, 'dist', 'index.js'), '');
  writeFileSync(path.join(dir, 'receipts', 'identity.json'), JSON.stringify({ pure_candidate_P: RRA_PINNED, composite_runtime_C: RRA_PINNED, unit: `openclaw-proof-${COMP}`, port: 18899 }));
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
    candidateSha: RRA_PINNED,
    docsSha: 'd'.repeat(40),
    artifactDir: path.join(fixture.home, 'artifacts'),
    observerKeyFile: fixture.keyFile,
    ...extra,
  };
}

test('the control accepts a stopped j12′ proof-gw target and checks its sign-in against the isolated state only', () => {
  const fixture = proofGwFixture();
  try {
    const { platform, calls } = fakePlatform(fixture);
    const evaluated = evaluateRecipientAuthorityTarget(controlOptions(fixture), platform);
    assert.equal(evaluated.ok, true, JSON.stringify(evaluated.refusals));
    assert.deepEqual({ ...evaluated.gates }, {
      candidatePinned: true, buildInfoCommit: RRA_PINNED, stateIsolated: true, modelSignIn: true, crossSessionTargetingEnabled: true, gatewayStartedByHarness: false,
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

test('the control refuses: another candidate, a non-j12′ build, a live-overlapping state, no sign-in, disabled policy, a gateway it did not start', () => {
  const cases = [
    ['candidate-not-pinned', {}, (o) => ({ ...o, candidateSha: 'f15237ec921879d918482cdf372b0718d4c1aab9' }), {}],
    // j12 is the named baseline: neither its SHA nor its stage runs this row.
    ['candidate-not-pinned', {}, (o) => ({ ...o, candidateSha: RRA_J12 }), {}],
    ['stage-build-mismatch', { buildCommit: 'f15237ec921879d918482cdf372b0718d4c1aab9' }, (o) => o, {}],
    ['stage-build-mismatch', { buildCommit: RRA_J12 }, (o) => o, {}],
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

test('the control stops the gateway it started even when a case throws', async () => {
  const fixture = proofGwFixture();
  try {
    const signals = [];
    let exit;
    const { platform } = fakePlatform(fixture, {
      listenerOwner: () => ({ pid: 4242, startTicks: 77 }),
      spawnGateway: () => ({
        pid: 4242,
        lines: [],
        exited: new Promise((resolve) => { exit = resolve; }),
        signal: (sig) => {
          signals.push(sig);
          exit({ code: 0, signal: sig });
        },
      }),
      runK6: async () => {
        throw new Error('k6 crashed');
      },
    });
    await assert.rejects(runRecipientAuthorityRow(controlOptions(fixture), platform), /k6 crashed/);
    assert.deepEqual(signals, ['SIGTERM'], 'the generation the control started is stopped');
  } finally {
    fixture.cleanup();
  }
});

test('the control never asks a gateway it does not own to restart', async () => {
  const fixture = proofGwFixture();
  try {
    let owner = { pid: 4242, startTicks: 77 };
    const rpcs = [];
    const { platform } = fakePlatform(fixture, {
      listenerOwner: () => owner,
      gatewayRpc: async (call) => {
        rpcs.push(call.method);
        return { ok: true };
      },
      spawnGateway: () => ({ pid: 4242, lines: [], exited: new Promise(() => {}), signal: () => {} }),
      runK6: async ({ env }) => {
        // The drive phase hands over for the restart; meanwhile another process took the port.
        owner = { pid: 5151, startTicks: 99 };
        const evidence = { row: RRA_ROW, case: env.OPENCLAW_RCD_RA_CASE, phase: env.OPENCLAW_RCD_RA_PHASE, control_run_id: env.OPENCLAW_RCD_RA_RUN, candidate_sha: RRA_PINNED, keys: { parent: 'p', target: 't' }, handoff: { ready_for_restart: true }, refusals: [] };
        return { code: 0, log: `R_CD_RECIPIENT_AUTHORITY_EVIDENCE ${JSON.stringify(evidence)}\n` };
      },
    });
    const result = await runRecipientAuthorityRow(controlOptions(fixture, { cases: ['replay-restart'] }), platform);
    assert.equal(result.ok, true);
    assert.deepEqual(rpcs, [], 'no restart request reaches a gateway the control does not own');
    const receipt = JSON.parse(readFileSync(path.join(fixture.home, 'artifacts', 'replay-restart', 'case-receipt.json'), 'utf8'));
    assert.equal(receipt.grade.verdict, 'MISSING-candidate');
    assert.ok(receipt.grade.missing.includes('gateway-not-harness-owned'));
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
    candidate_sha: RRA_PINNED,
    keys: { parent: 'agent:main:r-cd-ra-revoked-visibility-parent-abc', target: 'agent:main:r-cd-ra-revoked-visibility-target-abc', ops: null },
    reason_hash: 'abcdef0123456789',
    reason_length: 120,
    delegate_mode: 'silent',
    target_primed: true,
    dispatch: { status: 'scheduled', accepted: true, result_mode: 'silent', result_delay_seconds: 30, observed_at_ms: 1_000 },
    other_delegate_calls: 0,
    pre_transition_obs: { ackRuns: 0, foreignRuns: 0, unattributedAssistantRows: 0, returnMarkerRows: 0, probeReplied: false, adoptedDeliveryRows: 0 },
    child: { spawned: true, bound: true, done: true, key: CHILD_KEY },
    transition: { method: 'session.visibility.set', ok: true, requested_at_ms: 5_000, settled_at_ms: 5_100 },
    probe_ran: true,
    probe_sent_at_ms: 59_000,
    target_obs: { ackRuns: 0, foreignRuns: 0, unattributedAssistantRows: 0, returnMarkerRows: 0, probeReplied: true, adoptedDeliveryRows: 0 },
    parent_ack_rows: 0,
    refusals: [],
    preflight: { ok: true },
  };
}

const CHILD_KEY = 'agent:main:subagent:continuation-rra-c';

/** revoked-visibility at j12′: parked at 3 s, transition at 5 s, refused by the probe's drain at 60 s. */
function revokedHarness(evidence) {
  const { target, parent } = evidence.keys;
  return {
    logEntries: [
      { atMs: 3_000, text: `[continuation:targeted-return] Delivered to ${target} from ${CHILD_KEY}`, generation: 0 },
      { atMs: 6_000, text: refusedConsole('prompt-drain', parent, 'f'.repeat(64)), generation: 0 },
      { atMs: 60_000, text: refusedConsole('prompt-drain', target), generation: 0 },
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
  assert.deepEqual(record.routing, { duringTransition: 0, afterTransition: 0 }, 'the park line precedes the transition');
  assert.equal(record.target.probeSentAtMs, 59_000);
  assert.deepEqual(record.reason, {
    kind: 'return-refused',
    stage: 'prompt-drain',
    stages: ['prompt-drain'],
    reasonTexts: ['recipient-authority-changed'],
    observedAtMs: 60_000,
    generation: 0,
    deliveryIdHash: sha256Hex(DELIVERY_ID),
    distinctDeliveryIds: 1,
    linesWithoutDeliveryId: 0,
    lines: 1,
  }, 'the parent\'s line is another session');
  assert.notEqual(record.epochs.captured, record.epochs.afterTransition, 'the captured epoch is read before the transition');
  assert.equal(gradeRecipientAuthorityCase({ ...record, trace: { correlated: true } }).verdict, 'PASS-candidate');
  const publicText = JSON.stringify(record);
  for (const secret of [evidence.keys.target, evidence.keys.parent, CHILD_KEY, DELIVERY_ID, '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']) {
    assert.ok(!publicText.includes(secret), `public record leaks ${secret}`);
  }
  const assemble = (logEntries, extra = {}) => assembleCaseRecord({ caseId: 'revoked-visibility', runId: RUN, docsSha: 'd'.repeat(40), gates: completeRecord('allowed').gates, evidence: { ...evidence, ...extra }, logEntries, timeline: harness.timeline, generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }], cleanup: { gatewayStopped: true, residue: false }, startedAtMs: 500 });
  const grade = (logEntries, extra) => gradeRecipientAuthorityCase({ ...assemble(logEntries, extra), trace: { correlated: true } });
  const noReason = assemble(harness.logEntries.slice(0, 2));
  assert.equal(noReason.reason, null);
  assert.equal(gradeRecipientAuthorityCase({ ...noReason, trace: { correlated: true } }).verdict, 'MISSING-candidate');
  // j12's replay line is not j12′'s reason: the case has none.
  const j12Only = grade([...harness.logEntries.slice(0, 2), { atMs: 60_000, text: j12ReplayLine(evidence.keys.target), generation: 0 }]);
  assert.equal(j12Only.verdict, 'MISSING-candidate');
  assert.ok(j12Only.missing.includes('refusal-reason-not-observed'));
  // A refusal at another stage than the pinned one is never PASS.
  const wrongStage = grade([...harness.logEntries.slice(0, 2), { atMs: 60_000, text: refusedConsole('replay', evidence.keys.target), generation: 0 }]);
  assert.equal(wrongStage.verdict, 'MISSING-candidate');
  assert.ok(wrongStage.missing.includes('refusal-stage-mismatch'));
  // The sweep may report the same row once more after the probe's drain retired it: allowed, and
  // only that stage, only that row.
  assert.equal(grade([...harness.logEntries, { atMs: 70_000, text: refusedConsole('replay', evidence.keys.target), generation: 0 }]).verdict, 'PASS-candidate');
  const laterWake = grade([...harness.logEntries, { atMs: 70_000, text: refusedConsole('wake', evidence.keys.target), generation: 0 }]);
  assert.ok(laterWake.missing.includes('refusal-stage-mismatch'), JSON.stringify(laterWake));
  const laterOtherRow = grade([...harness.logEntries, { atMs: 70_000, text: refusedConsole('replay', evidence.keys.target, 'c'.repeat(64)), generation: 0 }]);
  assert.ok(laterOtherRow.missing.includes('reason-delivery-id-ambiguous'), JSON.stringify(laterOtherRow));
  const laterNoRow = grade([...harness.logEntries, { atMs: 70_000, text: refusedConsole('enqueue', evidence.keys.target, null), generation: 0 }]);
  assert.ok(laterNoRow.missing.includes('refusal-stage-mismatch') && laterNoRow.missing.includes('reason-delivery-id-ambiguous'), JSON.stringify(laterNoRow));
  // The reason must be j12′'s one reason on every line.
  const otherReason = grade([...harness.logEntries.slice(0, 2), { atMs: 60_000, text: refusedConsole('prompt-drain', evidence.keys.target).replace('recipient-authority-changed', 'other-reason'), generation: 0 }]);
  assert.ok(otherReason.missing.includes('refusal-reason-mismatch'), JSON.stringify(otherReason));
  // A return routed while the transition RPC was in flight may have been read as current: MISSING,
  // never FAIL, whatever it then did (review finding: route 5050, request 5000, settle 5100).
  const inFlight = grade([harness.logEntries[1], harness.logEntries[2], { atMs: 5_050, text: `[continuation:targeted-return] Delivered to ${evidence.keys.target} from ${CHILD_KEY}`, generation: 0 }], {
    target_obs: { ...evidence.target_obs, ackRuns: 1, adoptedDeliveryRows: 1 },
  });
  assert.equal(inFlight.verdict, 'MISSING-candidate', JSON.stringify(inFlight));
  assert.ok(inFlight.missing.includes('return-not-parked-before-transition') && inFlight.missing.includes('return-routed-during-transition'));
  assert.deepEqual(inFlight.contradictions, []);
  // A prompt-drain line from before the probe was sent is not the probe's drain.
  const beforeProbe = grade(harness.logEntries, { probe_sent_at_ms: 61_000 });
  assert.ok(beforeProbe.missing.includes('reason-not-from-probe-drain'));
  // A Delivered to line naming the refused target after its transition contradicts the refusal.
  const routedAgain = grade([...harness.logEntries, { atMs: 61_000, text: `[continuation:targeted-return] Delivered to ${evidence.keys.target} from ${CHILD_KEY}`, generation: 0 }]);
  assert.equal(routedAgain.verdict, 'FAIL-candidate');
  assert.ok(routedAgain.contradictions.includes('refused-return-routed'));
  // So does j12's empty-list line from the case's child.
  const emptyList = grade([...harness.logEntries, { atMs: 61_000, text: `[continuation:targeted-return] Delivered to  from ${CHILD_KEY}`, generation: 0 }]);
  assert.equal(emptyList.verdict, 'FAIL-candidate');
  assert.ok(emptyList.contradictions.includes('refused-return-routed'));
  // Another session's router line after the transition is not this return's.
  assert.equal(grade([...harness.logEntries, { atMs: 61_000, text: '[continuation:targeted-return] Delivered to agent:main:x from agent:main:subagent:other', generation: 0 }]).verdict, 'PASS-candidate');
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

/* ------------------------------------------------------------------------------------ */
/* The continue_work case (work-revoked-visibility)                                      */
/* ------------------------------------------------------------------------------------ */

test('work-revoked-visibility: a kept continue_work wake refused at the handoff, pinned to stage=wake', () => {
  const spec = RRA_CASES[WORK_CASE];
  assert.deepEqual(
    [spec.family, spec.tool, spec.refusedAt, spec.timing, spec.transition, spec.reasonKind, spec.flowId, spec.expectChild, spec.laterStages],
    ['refusal', 'continue_work', 'wake', 'before-wake', 'session.visibility.set', 'work-refused', true, false, undefined],
  );
  assert.match(spec.refusedAtBytes, /work-dispatch\.ts:529/u);
  assert.equal(gradeRecipientAuthorityCase(completeRecord(WORK_CASE)).verdict, 'PASS-candidate');
  // Its wake never fires, so it owes no trace receipt.
  assert.equal(gradeRecipientAuthorityCase(mutate(completeRecord(WORK_CASE), (r) => { r.trace = null; })).verdict, 'PASS-candidate');
  assert.equal(gradeRecipientAuthorityCase(mutate(completeRecord(WORK_CASE), (r) => { r.cleanup.residue = true; })).verdict, 'PARTIAL-candidate');
  // The row's gates come first: a record of the interim pin is not about j12′.
  for (const fn of [(r) => { r.candidateSha = INTERIM; }, (r) => { r.gates.buildInfoCommit = INTERIM; }]) {
    const graded = gradeRecipientAuthorityCase(mutate(completeRecord(WORK_CASE), (r) => { fn(r); r.target.foreignRuns = 1; }));
    assert.equal(graded.verdict, 'MISSING-candidate');
    assert.deepEqual(graded.contradictions, []);
  }
});

test('work-revoked-visibility is never PASS without its work-refused line at stage=wake, after the transition and before the probe, naming one election', () => {
  const holes = {
    'refusal-reason-not-observed': (r) => { r.reason = null; },
    'refusal-reason-not-observed (a return-refused reason)': (r) => { r.reason.kind = 'return-refused'; },
    'refusal-reason-not-observed (before the transition)': (r) => { r.reason.observedAtMs = 4_000; },
    'refusal-reason-mismatch (an unbound election\'s reason)': (r) => { r.reason.reasonTexts = ['recipient-authority-unverifiable']; },
    'refusal-reason-mismatch (mixed)': (r) => { r.reason.reasonTexts = ['recipient-authority-changed', 'recipient-authority-unverifiable']; },
    'refusal-reason-mismatch (unread)': (r) => { r.reason.reasonTexts = undefined; },
    'refusal-stage-mismatch (replay)': (r) => { r.reason.stage = 'replay'; r.reason.stages = ['replay']; },
    'refusal-stage-mismatch (adoption)': (r) => { r.reason.stage = 'adoption'; r.reason.stages = ['adoption']; },
    'refusal-stage-mismatch (a later adoption line)': (r) => { r.reason.stages = ['wake', 'adoption']; r.reason.lines = 2; },
    'reason-flow-id-ambiguous': (r) => { r.reason.distinctFlowIds = 2; },
    'reason-flow-id-ambiguous (unread)': (r) => { r.reason.distinctFlowIds = undefined; },
    'reason-flow-id-ambiguous (no hash)': (r) => { r.reason.flowIdHash = null; },
    'reason-not-before-probe': (r) => { r.reason.observedAtMs = 51_000; },
    'reason-not-before-probe (unsent)': (r) => { r.target.probeSentAtMs = null; },
  };
  for (const [label, fn] of Object.entries(holes)) {
    const graded = gradeRecipientAuthorityCase(mutate(completeRecord(WORK_CASE), fn));
    assert.equal(graded.verdict, 'MISSING-candidate', `${label}: ${JSON.stringify(graded)}`);
    assert.ok(graded.missing.includes(label.replace(/ \(.*\)$/u, '')), `${label}: ${graded.missing}`);
  }
});

test('work-revoked-visibility is never PASS without the observed absence, and a wake turn or adoption is FAIL', () => {
  for (const [label, fn] of Object.entries({
    'transcript-not-read': (r) => { r.target.foreignRuns = null; },
    'transcript-not-read (marker)': (r) => { r.target.adoptedDeliveryRows = undefined; },
    'unattributable-target-rows': (r) => { r.target.unattributedAssistantRows = 1; },
    'probe-turn-unobserved': (r) => { r.target.probeRan = false; },
    'probe-turn-unobserved (no reply)': (r) => { r.target.probeReplied = false; },
    'electing-run-unrecorded': (r) => { r.target.primed = false; },
    'election-not-accepted': (r) => { r.dispatch.status = 'error'; r.dispatch.accepted = false; },
  })) {
    const graded = gradeRecipientAuthorityCase(mutate(completeRecord(WORK_CASE), fn));
    assert.equal(graded.verdict, 'MISSING-candidate', label);
    assert.ok(graded.missing.includes(label.replace(/ \(.*\)$/u, '')), `${label}: ${graded.missing}`);
  }
  for (const [code, fn] of Object.entries({
    'target-woken': (r) => { r.target.foreignRuns = 1; },
    'refused-work-adopted': (r) => { r.target.adoptedDeliveryRows = 1; },
  })) {
    const graded = gradeRecipientAuthorityCase(mutate(completeRecord(WORK_CASE), fn));
    assert.equal(graded.verdict, 'FAIL-candidate', code);
    assert.ok(graded.contradictions.includes(code), `${code}: ${graded.contradictions}`);
  }
  // The model repeating the reason's marker in the probe turn decides nothing: only a run is a wake.
  assert.equal(gradeRecipientAuthorityCase(mutate(completeRecord(WORK_CASE), (r) => { r.target.returnMarkerRows = 1; r.target.ackRuns = 1; })).verdict, 'PASS-candidate');
});

test('work-revoked-visibility: a capture not seen before the transition, a late transition or a deviation is MISSING, never FAIL', () => {
  const woke = (r) => { r.target.foreignRuns = 1; r.target.adoptedDeliveryRows = 1; };
  for (const [label, fn] of Object.entries({
    'capture-unobserved': (r) => { r.epochs.capturedAfterMs = null; },
    'capture-unobserved (no row)': (r) => { r.epochs.capturedByMs = null; r.epochs.captured = null; },
    'capture-unobserved (out of order)': (r) => { r.epochs.capturedAfterMs = 2_500; },
    'capture-not-before-transition': (r) => { r.epochs.capturedByMs = 5_500; },
    // The wake is due no earlier than 1.5 s + (30 - 1) s.
    'transition-not-before-wake': (r) => { r.transition.settledAtMs = 30_600; },
    'transition-not-before-wake (no delay)': (r) => { r.dispatch.resultDelaySeconds = null; },
    'transition-not-observed': (r) => { r.transition.ok = false; },
    'transition-did-not-advance-epoch': (r) => { r.epochs.afterTransition = r.epochs.captured; },
    'epochs-unread': (r) => { r.epochs.afterTransition = null; },
    'extra-work-calls': (r) => { r.dispatch.otherWorkCalls = 1; },
    'extra-delegate-calls': (r) => { r.dispatch.otherDelegateCalls = 1; },
    'delegate-calls-unread': (r) => { r.dispatch.otherWorkCalls = null; },
    'wake-ran-before-transition': (r) => { r.preTransition.foreignRuns = 1; },
    'pre-transition-unread': (r) => { r.preTransition = null; },
    'scenario-refused': (r) => { r.scenario.refusals = ['websocket error']; },
    'preflight-not-ok': (r) => { r.scenario.preflightOk = false; },
  })) {
    const graded = gradeRecipientAuthorityCase(mutate(completeRecord(WORK_CASE), (r) => { fn(r); woke(r); }));
    assert.equal(graded.verdict, 'MISSING-candidate', `${label}: ${JSON.stringify(graded)}`);
    assert.ok(graded.missing.includes(label.replace(/ \(.*\)$/u, '')), `${label}: ${graded.missing}`);
    assert.deepEqual(graded.contradictions, [], `${label}: a wake the premise does not rule out is not judged`);
  }
  // Just inside the bound the premise holds, and the same wake is FAIL.
  const inside = gradeRecipientAuthorityCase(mutate(completeRecord(WORK_CASE), (r) => { r.transition.settledAtMs = 30_400; woke(r); }));
  assert.equal(inside.verdict, 'FAIL-candidate', JSON.stringify(inside));
});

/** j12′'s refused-work line as the console prints it (return-refusal.ts:38-46). */
const FLOW_ID = '0b5e9a2c-7d1f-4e3a-9c4b-2f6d8e1a0c3b';
const workConsole = (stage, key, { reason = 'recipient-authority-changed', flowId = FLOW_ID } = {}) =>
  `08:00:00.000 [continuation/work-refused] [continuation:work-refused] stage=${stage} reason=${reason} session=${key} flowId=${flowId}`;
const workFile = (stage, key, meta = {}) => JSON.stringify({
  0: JSON.stringify({ subsystem: 'continuation/work-refused' }),
  1: { stage, reason: 'recipient-authority-changed', sessionKey: key, flowId: FLOW_ID, ...meta },
  2: `[continuation:work-refused] stage=${stage} reason=recipient-authority-changed session=${key} flowId=${FLOW_ID}`,
  _meta: { logLevelName: 'WARN', name: JSON.stringify({ subsystem: 'continuation/work-refused' }) },
  time: '2026-11-04T08:00:00.000Z',
});

test('j12′\'s refused-work line is read from the console or the file log, and never as or from a return-refused line', () => {
  const key = 'agent:main:r-cd-ra-work-revoked-visibility-target-abc';
  for (const stage of ['replay', 'wake', 'adoption']) {
    for (const line of [workConsole(stage, key), workFile(stage, key), `\u001b[35m[continuation/work-refused]\u001b[39m [continuation:work-refused] stage=${stage} reason=recipient-authority-changed session=${key} flowId=${FLOW_ID}`]) {
      assert.deepEqual(parseWorkRefusedLine(line), { stage, reason: 'recipient-authority-changed', session: key, flowId: FLOW_ID }, line);
      assert.equal(matchReasonLine(line, 'work-refused', { targetKey: key }), true, line);
      assert.equal(parseReturnRefusedLine(line), null, `a work line is no return refusal: ${line}`);
    }
  }
  const jsonConsole = JSON.stringify({ subsystem: 'continuation/work-refused', message: `[continuation:work-refused] stage=wake reason=recipient-authority-changed session=${key} flowId=${FLOW_ID}`, stage: 'wake', sessionKey: key, flowId: FLOW_ID });
  assert.equal(parseWorkRefusedLine(jsonConsole)?.stage, 'wake');
  const message = `[continuation:work-refused] stage=wake reason=recipient-authority-changed session=${key} flowId=${FLOW_ID}`;
  for (const line of [
    refusedConsole('wake', key),
    `[agent/embedded] ${message}`,
    `08:00:00 [agent/embedded] assistant text: [continuation/work-refused] ${message}`,
    `08:00:00.000 [continuation/work-refused] [continuation:work-refused] stage=wake reason=recipient-authority-changed session=${key}`,
    `${workConsole('wake', key)} extra`,
    workFile('wake', key, { stage: 'replay' }),
    workFile('wake', key, { flowId: 'other' }),
    workFile('wake', key, { sessionKey: `${key}2` }),
    JSON.stringify({ 0: '{"subsystem":"agent/embedded"}', 2: message }),
    JSON.stringify({ subsystem: 'continuation/return-refused', message }),
    '08:00:00 [continuation/work-authority] [continuation:work-authority-unread] stage=wake count=1 error=x',
  ]) {
    assert.equal(parseWorkRefusedLine(line), null, line);
  }
  assert.equal(matchReasonLine(workConsole('wake', key, { reason: 'recipient-authority-unverifiable' }), 'work-refused', { targetKey: key }), false);
  assert.equal(matchReasonLine(workConsole('wake', `${key}2`), 'work-refused', { targetKey: key }), false, 'a longer key is another session');
  assert.equal(matchReasonLine(refusedConsole('wake', key), 'work-refused', { targetKey: key }), false);
  const entries = [
    { atMs: 10, text: workConsole('wake', key) },
    { atMs: 20, text: workConsole('wake', 'agent:main:other') },
    { atMs: 30, text: workConsole('adoption', key, { flowId: 'f-2' }), generation: 1 },
    { atMs: 40, text: refusedConsole('wake', key) },
  ];
  assert.deepEqual(findWorkRefusals(entries, key, 15).map(({ atMs, stage, flowId, generation }) => [atMs, stage, flowId, generation]), [[30, 'adoption', 'f-2', 1]]);
  assert.equal(findWorkRefusals(entries, key).length, 2);
  assert.deepEqual(findWorkRefusals(entries, ''), []);
});

test('work election binding: the case\'s own continue_work call, through Tool Search or not, paired by toolCallId', () => {
  const reason = 'RCDRA:abc Proof wake n: when this continuation runs, reply exactly RCDRA-WOKE n.';
  const viaSearch = (id, args) => ({ role: 'assistant', content: [{ type: 'toolCall', id, name: 'dispatch_action', arguments: { id: 'openclaw:core:continue_work', args } }], __openclaw: { runId: 'run-e' } });
  const direct = (id, args) => ({ role: 'assistant', content: [{ type: 'toolCall', id, name: 'continue_work', arguments: args }], __openclaw: { runId: 'run-e' } });
  const result = (id, payload, isError = false) => ({ role: 'toolResult', toolCallId: id, toolName: 'dispatch_action', isError, content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }] });
  for (const call of [viaSearch, direct]) {
    assert.deepEqual(findWorkElection([call('w1', { reason, delaySeconds: 30 }), result('w1', { status: 'scheduled', delaySeconds: 30 })], { reasonMarker: 'RCDRA:abc' }), { status: 'scheduled', toolCallId: 'w1', delaySeconds: 30 });
  }
  assert.deepEqual(findWorkElection([viaSearch('w2', { reason })], { reasonMarker: 'RCDRA:abc' }), { status: null, toolCallId: 'w2', delaySeconds: null });
  assert.equal(findWorkElection([viaSearch('w3', { reason }), result('w3', 'continue_work requires an active session.', true)], { reasonMarker: 'RCDRA:abc' }).status, 'error');
  assert.equal(findWorkElection([viaSearch('w4', { reason: 'other' }), result('w4', { status: 'scheduled' })], { reasonMarker: 'RCDRA:abc' }), null);
  // A continue_delegate call is no election.
  assert.equal(findWorkElection([{ role: 'assistant', content: [{ type: 'toolCall', id: 'c1', name: 'continue_delegate', arguments: { task: reason } }] }, result('c1', { status: 'scheduled' })], { reasonMarker: 'RCDRA:abc' }), null);
  assert.equal(countWorkCalls([viaSearch('w1', { reason }), direct('w2', { reason }), say('x', 'r')]), 2);
  assert.equal(countDelegateCalls([viaSearch('w1', { reason })]), 0);
  // Limited to the case's own runs: a wake turn's call is that wake's, never the electing run's;
  // a row with no run id cannot be placed elsewhere, so it still counts.
  const wakeCall = { ...direct('w3', { reason }), __openclaw: { runId: 'run-wake' } };
  const unplaced = { role: 'assistant', content: [{ type: 'toolCall', id: 'w4', name: 'continue_work', arguments: { reason } }] };
  const delegateInWake = { role: 'assistant', content: [{ type: 'toolCall', id: 'c2', name: 'continue_delegate', arguments: { task: 'x' } }], __openclaw: { runId: 'run-wake' } };
  const transcript = [viaSearch('w1', { reason }), wakeCall, unplaced, delegateInWake];
  assert.equal(countWorkCalls(transcript), 3);
  assert.equal(countWorkCalls(transcript, { inRuns: ['run-e', 'run-probe'] }), 2);
  assert.equal(countDelegateCalls(transcript), 1);
  assert.equal(countDelegateCalls(transcript, { inRuns: ['run-e', 'run-probe'] }), 0);
});

/** work-revoked-visibility at j12′: scheduled at 1 s, captured by 1.5 s, narrowed at 5 s, refused at 32 s, probed at 50 s. */
function workEvidence() {
  return {
    ...revokedEvidence(),
    case: WORK_CASE,
    keys: { parent: null, target: 'agent:main:r-cd-ra-work-revoked-visibility-target-abc', ops: null },
    delegate_mode: null,
    reason_length: 140,
    dispatch: { status: 'scheduled', accepted: true, result_mode: null, result_delay_seconds: 30, observed_at_ms: 1_000 },
    other_delegate_calls: 0,
    other_work_calls: 0,
    child: { spawned: null, bound: false, done: false, key: null },
    transition: { method: 'session.visibility.set', ok: true, requested_at_ms: 5_000, settled_at_ms: 5_100 },
    probe_sent_at_ms: 50_000,
  };
}

test('the control assembles the continue_work case: its capture from the store, its reason from the work line, ids hashed', () => {
  const evidence = workEvidence();
  const key = evidence.keys.target;
  const e1 = '11111111-1111-4111-8111-111111111111';
  const e2 = '22222222-2222-4222-8222-222222222222';
  const timeline = [
    { atMs: 900, state: 'read', rows: [] },
    { atMs: 1_100, state: 'read', rows: [] },
    { atMs: 1_300, state: 'unreadable', rows: [] },
    { atMs: 1_600, state: 'read', rows: [{ session_key: key, epoch: e1 }] },
    { atMs: 5_200, state: 'read', rows: [{ session_key: key, epoch: e2 }] },
  ];
  const logEntries = [{ atMs: 32_000, text: workConsole('wake', key), generation: 0 }];
  const assemble = (extra = {}) => assembleCaseRecord({
    caseId: WORK_CASE, runId: RUN, docsSha: 'd'.repeat(40), gates: completeRecord('allowed').gates, evidence, logEntries, timeline,
    generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }], cleanup: { gatewayStopped: true, residue: false }, startedAtMs: 500, ...extra,
  });
  const record = assemble();
  assert.deepEqual(record.epochs, { captured: sha256Hex(e1), capturedAfterMs: 1_100, capturedByMs: 1_600, afterTransition: sha256Hex(e2), final: sha256Hex(e2) });
  assert.deepEqual(record.reason, { kind: 'work-refused', stage: 'wake', stages: ['wake'], reasonTexts: ['recipient-authority-changed'], observedAtMs: 32_000, generation: 0, flowIdHash: sha256Hex(FLOW_ID), distinctFlowIds: 1, lines: 1 });
  assert.equal(record.dispatch.otherWorkCalls, 0);
  assert.equal(record.routing, null);
  assert.equal(record.keys.parent, null);
  assert.equal(gradeRecipientAuthorityCase(record).verdict, 'PASS-candidate', JSON.stringify(gradeRecipientAuthorityCase(record)));
  const publicText = JSON.stringify(record);
  for (const secret of [key, FLOW_ID, e1, e2]) assert.ok(!publicText.includes(secret), `public record leaks ${secret}`);
  // The delegate cases' records carry no work field.
  assert.equal(Object.hasOwn(assembleCaseRecord({ caseId: 'revoked-visibility', runId: RUN, docsSha: 'd'.repeat(40), gates: completeRecord('allowed').gates, evidence: revokedEvidence(), ...revokedHarness(revokedEvidence()), generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }], cleanup: { gatewayStopped: true, residue: false }, startedAtMs: 500 }).dispatch, 'otherWorkCalls'), false);
  // The row first appears only after the transition was requested: no capture before it.
  const late = assemble({ timeline: [timeline[0], timeline[1], { atMs: 5_050, state: 'read', rows: [{ session_key: key, epoch: e2 }] }, timeline[4]] });
  assert.equal(late.epochs.capturedByMs, 5_050);
  const lateGrade = gradeRecipientAuthorityCase(late);
  assert.ok(lateGrade.missing.includes('capture-not-before-transition'), JSON.stringify(lateGrade));
  // The row in the very first sample: nothing bounds the capture from below.
  const early = assemble({ timeline: timeline.slice(3) });
  assert.equal(early.epochs.capturedAfterMs, null);
  assert.ok(gradeRecipientAuthorityCase(early).missing.includes('capture-unobserved'));
  // A line before the transition is not searched; a return-refused line is not this case's reason.
  assert.equal(assemble({ logEntries: [{ atMs: 4_000, text: workConsole('wake', key), generation: 0 }] }).reason, null);
  assert.equal(assemble({ logEntries: [{ atMs: 32_000, text: refusedConsole('wake', key), generation: 0 }] }).reason, null);
});
