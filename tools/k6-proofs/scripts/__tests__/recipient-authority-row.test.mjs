// R-CD-RECIPIENT-AUTHORITY: a live, isolated-gateway row (🌊's ruling, room msg
// 1567077062139838485; docs#536), pinned to the merged j12′ with the delegate dispatch grant 2907e656
// (msg 1567104742604406896; gate 3, msg 1567194866507841678; the grant, msg 1567487338383413250). Registration, the live-run guard's refusal, the verdict rules
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
  RRA_PROBE_CONDITION,
  RRA_PROBE_NONCE_SLOT,
  RRA_PROBE_TEXT_SHA256,
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
  parseSweepArmedLine,
  parseWorkRefusedLine,
  routedFromChild,
  routedToTarget,
  rraProbeText,
  rraProbeTextProblems,
  rraProofId,
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
/** The merged j12′ with the delegate dispatch grant, which every record must name. */
const MERGED_J12P = '2907e656a892c0efa93821670e9488c07be12c17';
/** The refused chain e9dc1c31, the row's former interim pin: history, graded only, never fired. */
const INTERIM = 'e9dc1c318a2f73fd01755fc4682fa3349e8a0e94';
/** The merged j12′ before the delegate dispatch grant, the row's former pin: history, graded only; its one-case smoke stopped before any receipt. */
const PRE_GRANT = '1ab5a73e14309922fa79edf4f93034bdb0acde62';
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
  assert.notEqual(manifest.invocation.pinnedCandidate, PRE_GRANT, 'the pre-grant head is history, never the pin');
  assert.equal(manifest.invocation.baselineCandidate, RRA_J12, 'j12 is the named baseline, never the pin');
  assert.deepEqual(manifest.invocation.cases, RRA_CASE_IDS);
  // The trace collector takes each case's mode from its evidence and refuses one invocation.modes
  // does not name: the list is exactly the modes the case table dispatches, the default among them.
  const caseModes = [...new Set(RRA_CASE_IDS.map((caseId) => RRA_CASES[caseId].mode).filter(Boolean))];
  assert.deepEqual([...manifest.invocation.modes].sort(), caseModes.sort());
  assert.ok(manifest.invocation.modes.includes(manifest.invocation.mode));
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
  for (const old of [INTERIM, PRE_GRANT]) {
    for (const stale of [`comp-${old.slice(0, 8)}`, `PROOFS/${old}`, `--candidate ${old}`, `setup ${old}`, `stop ${old}`]) assert.ok(!docs.includes(stale), stale);
  }
  // The status line: the owner's one run at the merged head, the three cases it left open now fixed,
  // and what the owner runs next.
  assert.match(docs, /^Status: \*\*10\/13 PASS-candidate at `2907e656` \(run `rra-88e4fd22f0b122a8`\); fixes landed, the probe\s+now conditional; owner fires the three at the new head, then the fresh 13\.\*\* In no corpus\./m);
  const status = docs.slice(0, docs.indexOf('## What it proves'));
  for (const open of ['`wake-reassigned`', '`reassigned`', '`allowed-silent`']) assert.match(status, new RegExp(`^- ${open}:`, 'm'), open);
  assert.doesNotMatch(status, /held for 🌊/, 'allowed-silent is ruled, no longer held');
  // 🌊's conditional-probe ruling, quoted; the probe text as sent; the old receipt never upgraded.
  assert.match(status, /stays MISSING `probe-ack-unobserved` and is never upgraded/);
  assert.match(docs, /1567590902694936678 \(the conditional probe\)/);
  const flat = docs.replace(/\s+/g, ' ');
  assert.ok(flat.includes(`'${RRA_PROBE_CONDITION} Otherwise reply exactly PROBE-OK ‹probe nonce›.'`), 'the ruling, quoted');
  assert.ok(flat.includes('The old receipt remains `probe-ack-unobserved`, not PASS."'), 'the ruling, quoted');
  assert.ok(docs.includes(`\n${rraProbeText('<probeNonce>')}\n`), 'the probe text as sent');
  assert.match(docs, /### The conditional probe/);
  assert.match(docs, /MISSING `probe-text-unbound`/, 'a receipt names the probe it sent');
  // 🌊's ruling (a), quoted, and the oracle it sets.
  assert.match(docs, /1567556038281007235/);
  assert.match(docs, /"TARGET-ACK\s+on the probe\s+turn, bound to this case's nonce and the target's priming\./);
  assert.match(docs, /### `allowed-silent`: the probe run's `TARGET-ACK`/);
  assert.match(docs, /a model that does not give it reads MISSING \(`probe-ack-unobserved`\), never FAIL/i);
  for (const caseId of RRA_CASE_IDS) assert.match(docs, new RegExp(`\`${caseId}\``), caseId);
  // The case table pins one stage per refused return.
  for (const caseId of RRA_CASE_IDS.filter((id) => ['return-refused', 'work-refused'].includes(RRA_CASES[id].reasonKind))) {
    assert.match(docs, new RegExp(`\\| \`${caseId}\` \\|[^\\n]*\`stage=${RRA_CASES[caseId].refusedAt}\``), caseId);
  }
  assert.match(docs, /## Operator procedure/);
  assert.match(docs, /5442236054/);
  const readme = readFileSync(path.join(k6Root, 'README.md'), 'utf8');
  const readmeLine = /^\| R-CD-RECIPIENT-AUTHORITY \| `run-recipient-authority-row\.mjs` \| [^\n]*$/m.exec(readme)?.[0] ?? '';
  assert.match(readmeLine, /j12′ 2907e656/);
  assert.doesNotMatch(readmeLine, /1ab5a73e/);
  assert.doesNotMatch(readmeLine, /interim/i);
  const readmeSection = /### R-CD-RECIPIENT-AUTHORITY [^\n]*\n[\s\S]*?(?=\n### )/.exec(readme)?.[0] ?? '';
  assert.match(readmeSection, new RegExp(MERGED_J12P));
  assert.doesNotMatch(readmeSection, /INTERIM/);
  const pipeline = readFileSync(path.join(k6Root, 'k6-proofs-pipeline.xml'), 'utf8');
  assert.match(pipeline, /<Row id="R-CD-RECIPIENT-AUTHORITY" [^>]*issue="docs#536"/);
  const pipelineRow = /<Row id="R-CD-RECIPIENT-AUTHORITY" [\s\S]*?<\/Row>/.exec(pipeline)?.[0] ?? '';
  assert.match(pipelineRow, /2907e656a892/);
  assert.doesNotMatch(pipelineRow, /INTERIM|e9dc1c318a2f|1ab5a73e1430/);
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
    'src/auto-reply/continuation/delegate-flow-store.ts:432-452, the binding at :435-442',
    'src/config/sessions/session-accessor.sqlite-entry-store.ts:56-69',
    'session-accessor.sqlite-owner.ts:158-182',
    'session-accessor.sqlite-entry-mutation.ts:119-136',
    'session-sharing-store.native.ts:150-195',
    'src/agents/tools/continue-delegate-tool.ts:353-362',
    'src/auto-reply/continuation/delegate-dispatch.ts:268-291',
    'src/auto-reply/continuation/delegate-store.ts:205-224',
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
    'src/auto-reply/reply/agent-runner-continuation-signal.ts:467',
    'custody-boot.ts:114-121 ->',
  ]) {
    assert.ok(scenario.includes(anchor), anchor);
  }
  // j12's anchors for the files j12′ changed, and the interim pin's for the files the merge moved, are gone.
  for (const stale of [
    'targeting.ts:240-254', 'continuation-wake.ts:127-238', 'server-restart-sentinel-delivery.ts:226-243', 'session event delivery skipped',
    'session-recipient-authority-types.ts:87-92', 'session-recipient-authority.worker.ts:35-50', 'return-refusal.ts:15-29',
    'session-reset-cleanup.ts:146-196', 'consumed at :194-196',
    // and the pre-grant head's for the five files the grant moved.
    'delegate-flow-store.ts:426-437', 'delegate-dispatch.ts:267-290', 'delegate-store.ts:204-218',
    'agent-runner-continuation-signal.ts:463', 'custody-boot.ts:107-114',
  ]) {
    assert.ok(!scenario.includes(stale), stale);
  }
});

test('the docs say what the delegate dispatch grant changes for the row, and what the row does not prove of it', () => {
  const docs = readFileSync(path.join(k6Root, 'docs', 'R-CD-RECIPIENT-AUTHORITY.md'), 'utf8');
  const capture = 'delegate-flow-store.ts:443-451';
  const captureOwner = 'delegate-dispatch-grant.ts:48-79';
  const restore = 'delegate-dispatch.ts:449-484';
  const restoreOwner = 'delegate-dispatch-grant.ts:85-141';
  const unitPins = 'subagent-spawn.continuation-operator-grant.test.ts';
  // The grant's own section: capture at election, restore at dispatch, the 1ab5a73e smoke, and no
  // case's stage or oracle moved.
  // Prose wraps, so the section and the bullet are read with their whitespace folded.
  const section = (/## The delegate dispatch grant and this row's operator connection\n[\s\S]*?(?=\n## )/.exec(docs)?.[0] ?? '').replace(/\s+/gu, ' ');
  for (const anchor of [capture, captureOwner, restore, restoreOwner, 'delegate-dispatch.ts:268-291', '1567487338383413250', 'Gateway caller authority is no longer active.']) {
    assert.ok(section.includes(anchor), anchor);
  }
  assert.match(section, /\*\*No case's expected stage or oracle changes\.\*\*/);
  assert.match(section, /The row now depends on the grant to spawn/);
  // Its capture for this row's own client shape is read from the bytes and pinned by no product test.
  assert.match(section, /\*\*Not pinned for this row's client shape\.\*\*/);
  // Under "does not prove": revocation, ceiling and expiry are the product's unit pins, not this row's.
  const doesNotProve = /It does not prove:\n[\s\S]*?(?=\n## )/.exec(docs)?.[0] ?? '';
  const grantBullet = (/- \*\*The grant's refusals\.\*\*[\s\S]*?(?=\n- \*\*)/.exec(doesNotProve)?.[0] ?? '').replace(/\s+/gu, ' ');
  for (const word of ['Revocation', 'scope ceiling', 'expiry', unitPins, 'This row cannot drive them']) assert.ok(grantBullet.includes(word), word);
  // The re-walk names each file the grant changed that the row cites, at its new lines.
  const rewalk = /### At `2907e656`, the delegate dispatch grant\n[\s\S]*?(?=\n### )/.exec(docs)?.[0] ?? '';
  for (const [file, at] of [
    ['custody-boot.ts', '`:114-121`'],
    ['delegate-flow-store.ts', '`:432-452`'],
    ['delegate-dispatch.ts', '`:268-291`'],
    ['delegate-store.ts', '`:205-224`'],
    ['agent-runner-continuation-signal.ts', '`:467`'],
    ['continuation/types.ts', '**not cited**'],
  ]) {
    const line = rewalk.split('\n').find((row) => row.startsWith(`| \`src/auto-reply/`) && row.includes(`${file}\``)) ?? '';
    assert.ok(line.includes(at), `${file}: ${at}`);
  }
  // The scenario header, the README section and the pipeline row carry the same grant.
  const scenario = readFileSync(path.join(k6Root, 'scenarios', 'r-cd-recipient-authority.js'), 'utf8');
  for (const anchor of [captureOwner, restoreOwner, unitPins]) assert.ok(scenario.includes(anchor), anchor);
  const readme = readFileSync(path.join(k6Root, 'README.md'), 'utf8');
  const readmeSection = /### R-CD-RECIPIENT-AUTHORITY [^\n]*\n[\s\S]*?(?=\n### )/.exec(readme)?.[0] ?? '';
  for (const anchor of [capture, restore]) assert.ok(readmeSection.includes(anchor), anchor);
  const pipeline = readFileSync(path.join(k6Root, 'k6-proofs-pipeline.xml'), 'utf8');
  const pipelineRow = /<Row id="R-CD-RECIPIENT-AUTHORITY" [\s\S]*?<\/Row>/.exec(pipeline)?.[0] ?? '';
  assert.match(pipelineRow, /dispatch grant/);
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
      probeTextSha256: refusal ? RRA_PROBE_TEXT_SHA256 : null,
      probeReplied: refusal,
      ackRuns: refusal ? 0 : 1,
      wakeAckRuns: refusal ? 0 : 1,
      probeAckRows: 0,
      primingAckRows: 0,
      uncreditedAckRows: 0,
      foreignRuns: refusal ? 0 : 1,
      unattributedAssistantRows: 0,
      returnMarkerRows: 0,
      adoptedDeliveryRows: 0,
    },
    parent: { ackRows: 0 },
    // allowed's ack was read in its woken run: the direct-wake path, labelled so.
    ack: spec.fallbackProbe ? { path: 'direct-wake', fallbackDecision: null } : null,
    preTransition: durable ? { ackRuns: 0, foreignRuns: 0, adoptedDeliveryRows: 0 } : null,
    transition: { method: spec.transition, ok: spec.transition ? true : null, requestedAtMs: spec.transition ? 5000 : null, settledAtMs: spec.transition ? 5100 : null },
    // A parked return was routed before its transition, from the case's child; a wake-mode one
    // never was.
    park: spec.timing === 'before-return'
      ? { deliveredToTargetAtMs: null, deliveredFromChildAtMs: null }
      : { deliveredToTargetAtMs: 4000, deliveredFromChildAtMs: 4000 },
    // The control saw that line, then released the transition (🌊's ruling, room msg 1567623059727458526).
    witness: spec.timing === 'parked' ? { parkedCopyAtMs: 4000, releasedAtMs: 4500 } : null,
    routing: durable ? { duringTransition: 0, afterTransition: 0 } : null,
    sweep: durable ? { armedInTransition: 0 } : null,
    epochs: { captured: H('a'), afterTransition: spec.transition ? (durable ? H('b') : H('a')) : null, final: durable ? H('b') : H('a') },
    reason: durable ? refusedReason(spec, { observedAtMs: 60000, generation: 0 }) : null,
    config: null,
    trace: spec.expectChild === false ? null : { correlated: true },
    cleanup: { gatewayStopped: true, residue: false },
  };
  if (spec.probeAdopts) {
    // 🌊's ruling (a): the probe turn adopts the parked silent return, and the primed target acks it
    // once in the probe's own run, sent after the router's Delivered to line from the child. As at
    // every pin for a sessions.send turn, no row carries the product's marker. The conditional probe
    // hands that turn to the priming, so the ack comes without PROBE-OK (room msg 1567590902694936678).
    record.target = {
      ...record.target,
      probeRan: true,
      probeSentAtMs: 20_000,
      probeTextSha256: RRA_PROBE_TEXT_SHA256,
      probeReplied: false,
      ackRuns: 1,
      wakeAckRuns: 0,
      probeAckRows: 1,
      foreignRuns: 0,
      adoptedDeliveryRows: 0,
    };
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
  assert.deepEqual(
    Object.fromEntries(durableCases.map((caseId) => [caseId, Object.fromEntries(Object.entries(RRA_CASES[caseId].otherFirstStages ?? {}).map(([stage, other]) => [stage, other.laterStages]))])),
    {
      'revoked-visibility': {}, 'revoked-membership': {}, 'revoked-owner': {},
      reassigned: { 'prompt-drain': ['replay'] },
      'wake-revoked-visibility': {}, 'wake-reassigned': {}, 'replay-restart': {},
    },
    'only reassigned has a second ordering: a sweep that re-queues the copy inside the delete',
  );
  for (const caseId of durableCases) {
    const spec = RRA_CASES[caseId];
    assert.match(spec.refusedAtBytes, /\.ts:\d+/u, caseId);
    for (const other of Object.values(spec.otherFirstStages ?? {})) assert.match(other.bytes, /\.ts:\d+/u, caseId);
    // Any other stage is never PASS: the case's claim is the pinned boundary, or the one other
    // boundary its bytes name.
    const firstStages = [spec.refusedAt, ...Object.keys(spec.otherFirstStages ?? {})];
    for (const stage of ['enqueue', 'replay', 'wake', 'prompt-drain'].filter((value) => !firstStages.includes(value))) {
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

// 🕯's live run at 2907e656 (rra-88e4fd22f0b122a8): reassigned's one line was stage=prompt-drain, 121 ms
// after the probe was sent, with the delete and create settled 160 s before. The delete consumes the
// copy before it commits the epoch advance, so a pending sweep that replays the row in between re-queues
// it while the epoch is still current, and the probe's drain is the first to see it stale.
test('reassigned: a sweep that re-queued the copy inside the delete leaves a prompt-drain refusal from the probe turn', () => {
  const spec = RRA_CASES.reassigned;
  const drained = (fn = () => {}) => mutate(completeRecord('reassigned'), (r) => {
    r.reason.stage = 'prompt-drain';
    r.reason.stages = ['prompt-drain'];
    // A pending sweep armed the parked row while the delete was in flight.
    r.sweep = { armedInTransition: 1 };
    fn(r);
  });
  // The pinned ordering stands: replay, before the probe, with no other line after it.
  assert.equal(gradeRecipientAuthorityCase(completeRecord('reassigned')).verdict, 'PASS-candidate');
  // The other ordering: the first line is the probe turn's drain, after the probe was sent.
  assert.equal(spec.otherFirstStages['prompt-drain'].bytes.includes('server-restart-sentinel-delivery.ts:263-274, 307-314'), true);
  assert.deepEqual(gradeRecipientAuthorityCase(drained()), { verdict: 'PASS-candidate', missing: [], contradictions: [], partial: [] });
  // Without a sweep seen arming the row while the delete was in flight, nothing could have re-queued
  // the copy: the drain line is not this ordering's. MISSING, never PASS.
  for (const sweep of [{ armedInTransition: 0 }, { armedInTransition: null }, {}, null, undefined]) {
    const unwitnessed = gradeRecipientAuthorityCase(drained((r) => { r.sweep = sweep; }));
    assert.equal(unwitnessed.verdict, 'MISSING-candidate', JSON.stringify(sweep));
    assert.deepEqual(unwitnessed.missing, ['no-sweep-armed-in-transition'], JSON.stringify(sweep));
  }
  // The pinned replay ordering needs no sweep in the delete, and no other case reads it.
  assert.equal(gradeRecipientAuthorityCase(mutate(completeRecord('reassigned'), (r) => { r.sweep = null; })).verdict, 'PASS-candidate');
  for (const caseId of ['revoked-visibility', 'revoked-membership', 'revoked-owner', 'replay-restart']) {
    assert.equal(gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.sweep = null; })).verdict, 'PASS-candidate', caseId);
  }
  // The sweep may report the same row once more after the drain retired it.
  assert.equal(gradeRecipientAuthorityCase(drained((r) => { r.reason.stages = ['prompt-drain', 'replay']; r.reason.lines = 2; })).verdict, 'PASS-candidate');
  // A drain line before the probe was sent is no probe turn's drain.
  for (const probeSentAtMs of [61_000, null]) {
    const early = gradeRecipientAuthorityCase(drained((r) => { r.target.probeSentAtMs = probeSentAtMs; }));
    assert.equal(early.verdict, 'MISSING-candidate', String(probeSentAtMs));
    assert.ok(early.missing.includes('reason-not-from-probe-drain'), String(probeSentAtMs));
  }
  // A replay refusal leaves no copy for a drain to refuse later, and no ordering puts enqueue or wake
  // after a drain.
  for (const stages of [['replay', 'prompt-drain'], ['prompt-drain', 'enqueue'], ['prompt-drain', 'wake']]) {
    const graded = gradeRecipientAuthorityCase(mutate(completeRecord('reassigned'), (r) => { r.reason.stage = stages[0]; r.reason.stages = stages; r.reason.lines = 2; }));
    assert.equal(graded.verdict, 'MISSING-candidate', stages.join(' then '));
    assert.ok(graded.missing.includes('refusal-stage-mismatch'), stages.join(' then '));
  }
  // The drain retires a written row: it names it, on every line.
  const rowless = gradeRecipientAuthorityCase(drained((r) => { r.reason.deliveryIdHash = null; r.reason.distinctDeliveryIds = 0; r.reason.linesWithoutDeliveryId = 1; }));
  assert.ok(rowless.missing.includes('refusal-delivery-id-mismatch'));
  // Absence still decides: an adoption, ack or wake after a drain refusal is FAIL.
  for (const [key, code] of [['ackRuns', 'refused-return-adopted'], ['adoptedDeliveryRows', 'refused-return-adopted'], ['foreignRuns', 'target-woken']]) {
    const graded = gradeRecipientAuthorityCase(drained((r) => { r.target[key] = 1; }));
    assert.equal(graded.verdict, 'FAIL-candidate', key);
    assert.ok(graded.contradictions.includes(code), key);
  }
  // The premise is unchanged: a return routed while the delete was in flight, routed only after it
  // was requested, or whose epoch the delete did not advance is MISSING, never PASS.
  const during = gradeRecipientAuthorityCase(drained((r) => { r.routing.duringTransition = 1; }));
  assert.ok(during.missing.includes('return-routed-during-transition'));
  const lateRoute = gradeRecipientAuthorityCase(drained((r) => { r.park.deliveredToTargetAtMs = 5500; }));
  assert.equal(lateRoute.verdict, 'MISSING-candidate');
  assert.ok(lateRoute.missing.includes('return-not-parked-before-transition'));
  const sameEpoch = gradeRecipientAuthorityCase(drained((r) => { r.epochs.afterTransition = r.epochs.captured; r.epochs.final = r.epochs.captured; }));
  assert.equal(sameEpoch.verdict, 'MISSING-candidate');
  assert.ok(sameEpoch.missing.includes('transition-did-not-advance-epoch'));
  // No other case gains a first stage.
  for (const caseId of durableCases.filter((id) => id !== 'reassigned')) {
    const other = RRA_CASES[caseId].refusedAt === 'prompt-drain' ? 'replay' : 'prompt-drain';
    const graded = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.reason.stage = other; r.reason.stages = [other]; }));
    assert.ok(graded.missing.includes('refusal-stage-mismatch'), caseId);
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
    'candidate-not-pinned (the pre-grant head)': (r) => { r.candidateSha = PRE_GRANT; },
    'gate:buildInfoCommit': (r) => { r.gates.buildInfoCommit = 'f15237ec921879d918482cdf372b0718d4c1aab9'; },
    'gate:buildInfoCommit (a j12 stage)': (r) => { r.gates.buildInfoCommit = RRA_J12; },
    'gate:buildInfoCommit (an interim stage)': (r) => { r.gates.buildInfoCommit = INTERIM; },
    'gate:buildInfoCommit (a pre-grant stage)': (r) => { r.gates.buildInfoCommit = PRE_GRANT; },
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

// 🌊's ruling (a), room msg 1567556038281007235: "TARGET-ACK on the probe turn, bound to this case's
// nonce and the target's priming. Remove the impossible sessionDeliveryAckIds requirement for
// sessions.send; keep the refusal lines as the negative evidence. The oracle should reject a
// pre-return or wrong-nonce ACK".
test('allowed-silent: exactly one ack of its nonce in the probe run, after the return reached the target, and no marker needed', () => {
  const silent = () => completeRecord('allowed-silent');
  const graded = (fn) => gradeRecipientAuthorityCase(mutate(silent(), fn));
  // The product's real shape at every pin: no marker on the sessions.send probe row, the ack in the
  // probe run. PASS (at 432e2c3e: MISSING adoption-marker-unobserved).
  assert.equal(silent().target.adoptedDeliveryRows, 0);
  assert.deepEqual(gradeRecipientAuthorityCase(silent()), { verdict: 'PASS-candidate', missing: [], contradictions: [], partial: [] });
  // The marker alone is no evidence any more: a marked probe row whose model never acked is MISSING
  // (at 432e2c3e: PASS, on the marker alone).
  const markerOnly = graded((r) => { r.target.adoptedDeliveryRows = 1; r.target.ackRuns = 0; r.target.probeAckRows = 0; });
  assert.equal(markerOnly.verdict, 'MISSING-candidate');
  assert.deepEqual(markerOnly.missing, ['probe-ack-unobserved']);
  // The model never acked: MISSING, never FAIL (the oracle is model-mediated).
  const noAck = graded((r) => { r.target.ackRuns = 0; r.target.probeAckRows = 0; });
  assert.deepEqual([noAck.verdict, noAck.missing, noAck.contradictions], ['MISSING-candidate', ['probe-ack-unobserved'], []]);
  // Pre-return: the probe was sent before (or at) the router's Delivered to line from the child.
  for (const sentAt of [4000, 3999, null]) {
    const early = graded((r) => { r.target.probeSentAtMs = sentAt; });
    assert.equal(early.verdict, 'MISSING-candidate', String(sentAt));
    assert.deepEqual(early.missing, ['probe-not-after-return'], String(sentAt));
  }
  // The anchor is this case's delivery: a Delivered to line for the target from another source, or
  // none, anchors nothing.
  for (const park of [{ deliveredToTargetAtMs: 4000, deliveredFromChildAtMs: null }, { deliveredToTargetAtMs: 4000 }]) {
    const unanchored = graded((r) => { r.park = park; });
    assert.equal(unanchored.verdict, 'MISSING-candidate', JSON.stringify(park));
    assert.deepEqual(unanchored.missing, ['return-not-routed-from-child'], JSON.stringify(park));
  }
  // Pre-return in the priming run: an ack before any return existed is never credited, and the
  // probe ack beside it proves nothing.
  const primed = graded((r) => { r.target.primingAckRows = 1; });
  assert.deepEqual([primed.verdict, primed.missing], ['MISSING-candidate', ['ack-before-return']]);
  const primedOnly = graded((r) => { r.target.primingAckRows = 1; r.target.ackRuns = 0; r.target.probeAckRows = 0; });
  assert.deepEqual([primedOnly.verdict, primedOnly.missing], ['MISSING-candidate', ['probe-ack-unobserved', 'ack-before-return']]);
  // Wrong nonce: alone, or beside the right one.
  const wrong = graded((r) => { r.target.ackRuns = 0; r.target.probeAckRows = 0; r.target.uncreditedAckRows = 1; });
  assert.deepEqual([wrong.verdict, wrong.missing], ['MISSING-candidate', ['probe-ack-unobserved', 'ack-uncredited']]);
  const mixed = graded((r) => { r.target.uncreditedAckRows = 1; });
  assert.deepEqual([mixed.verdict, mixed.missing], ['MISSING-candidate', ['ack-uncredited']]);
  // Two acks in the probe run: the model's, MISSING.
  const doubled = graded((r) => { r.target.probeAckRows = 2; });
  assert.deepEqual([doubled.verdict, doubled.missing, doubled.contradictions], ['MISSING-candidate', ['probe-ack-duplicated'], []]);
  // An ack in a foreign run is the silent return waking the target: FAIL, with or without the probe's.
  const foreign = graded((r) => { r.target.ackRuns = 1; r.target.probeAckRows = 0; r.target.foreignRuns = 1; });
  assert.equal(foreign.verdict, 'FAIL-candidate');
  assert.deepEqual(foreign.contradictions, ['silent-return-woke-target']);
  const both = graded((r) => { r.target.ackRuns = 2; r.target.foreignRuns = 1; });
  assert.equal(both.verdict, 'FAIL-candidate');
  assert.deepEqual(both.contradictions.sort(), ['duplicate-adoption', 'silent-return-woke-target']);
  // The rest of the chain stays required: a spawned, bound, done child; one acceptance; no refusal.
  for (const [code, fn] of [
    ['child-spawn-unobserved', (r) => { r.child.spawned = null; }],
    ['child-not-bound', (r) => { r.child.done = false; }],
    ['dispatch-not-accepted', (r) => { r.dispatch.accepted = false; }],
    ['extra-delegate-calls', (r) => { r.dispatch.otherDelegateCalls = 1; }],
    ['scenario-refused', (r) => { r.scenario.refusals = ['scenario window elapsed']; }],
    ['probe-turn-unobserved', (r) => { r.target.probeRan = false; }],
    ['transcript-not-read', (r) => { r.target.probeAckRows = undefined; }],
    ['transcript-not-read', (r) => { r.target.primingAckRows = null; }],
    ['transcript-not-read', (r) => { r.target.uncreditedAckRows = -1; }],
  ]) {
    const result = graded(fn);
    assert.equal(result.verdict, 'MISSING-candidate', code);
    assert.ok(result.missing.includes(code), `${code}: ${result.missing}`);
  }
  // A woken target is FAIL whether or not it acked.
  const woke = graded((r) => { r.target.foreignRuns = 1; });
  assert.equal(woke.verdict, 'FAIL-candidate');
  assert.ok(woke.contradictions.includes('silent-return-woke-target'));
  // Without the control the row cannot be PASS: the refusal cases' absence of an ack would be unproven.
  const rows = RRA_CASE_IDS.filter((caseId) => caseId !== 'allowed-silent').map((caseId) => ({ record: completeRecord(caseId), verified: true }));
  assert.equal(gradeRecipientAuthorityRow(rows).verdict, 'MISSING-candidate');
  assert.equal(gradeRecipientAuthorityRow([...rows, { record: mutate(silent(), (r) => { r.target.probeAckRows = 0; r.target.ackRuns = 0; }), verified: true }]).verdict, 'MISSING-candidate');
});

test('the refusal cases\' absence is no ack in the probe run; the marker is a check, never the evidence', () => {
  for (const caseId of refusalCases) {
    // An ack of the nonce in the probe run is the refused return adopted into the probe turn: FAIL,
    // with no marker on the row (the product's real shape for a sessions.send probe).
    const acked = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.probeAckRows = 1; r.target.ackRuns = 1; }));
    assert.equal(acked.verdict, 'FAIL-candidate', caseId);
    assert.ok(acked.contradictions.includes('refused-return-adopted'), caseId);
    // probeAckRows decides on its own, whatever ackRuns says.
    const probeOnly = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.probeAckRows = 1; }));
    assert.ok(probeOnly.contradictions.includes('refused-return-adopted'), caseId);
    // An ack-shaped reply with another nonce leaves the absence unread: MISSING.
    const ambiguous = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.uncreditedAckRows = 1; }));
    assert.deepEqual([ambiguous.verdict, ambiguous.missing], ['MISSING-candidate', ['ack-uncredited']], caseId);
    // The marker check stays: a marked row would still be FAIL.
    assert.equal(gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.adoptedDeliveryRows = 1; })).verdict, 'FAIL-candidate', caseId);
    // An unread probe-run count is MISSING, never a clean absence.
    const unread = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.probeAckRows = null; }));
    assert.ok(unread.missing.includes('transcript-not-read'), caseId);
    // A priming-run ack is the model echoing its instruction before anything was dispatched; a
    // refusal case's absence is read from the probe run and later runs only.
    assert.equal(gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.primingAckRows = 1; })).verdict, 'PASS-candidate', caseId);
  }
});

// 🌊's ruling, room msg 1567590902694936678: "make the probe conditional: 'If this turn includes the
// internal task completion for the proof you were primed for, follow that priming instruction
// instead. Otherwise reply exactly PROBE-OK ‹probe nonce›.' Keep `TARGET-ACK` and the row nonce out
// of the probe".
test('the probe text: 🌊\'s conditional wording with its own nonce, and the text test refuses the ack, the row nonce or other wording', () => {
  const rowNonce = 'RCDRA-1800000000010-abcdefgh';
  const probeNonce = 'RCDRA-PROBE-1800000000020-ijklmnop';
  const ruled = 'If this turn includes the internal task completion for the proof you were primed for, follow that priming instruction instead.';
  assert.equal(RRA_PROBE_CONDITION, ruled);
  const text = rraProbeText(probeNonce);
  assert.equal(text, `[k6-proof-harness] ${RRA_ROW} probe ${probeNonce}: ${ruled} Otherwise reply exactly PROBE-OK ${probeNonce}.`);
  const options = { rowNonce, probeNonce };
  assert.deepEqual(rraProbeTextProblems(text, options), []);
  // Only the probe nonce differs between two probes.
  assert.equal(rraProbeText('N2').replaceAll('N2', '<n>'), text.replaceAll(probeNonce, '<n>'));
  for (const [label, bad, codes] of [
    ['the ack marker', `${text} TARGET-ACK`, ['probe-names-ack', 'probe-not-conditional-wording']],
    ['the ack marker, any case', text.replace('priming instruction', 'Target-Ack instruction'), ['probe-names-ack', 'probe-not-conditional-wording']],
    ['the ack constant', `${text} (RRA_ACK_MARKER)`, ['probe-names-ack', 'probe-not-conditional-wording']],
    ['the row nonce', `${text} ${rowNonce}`, ['probe-names-row-nonce', 'probe-not-conditional-wording']],
    ['the row nonce, lower case', `${text} ${rowNonce.toLowerCase()}`, ['probe-names-row-nonce', 'probe-not-conditional-wording']],
    ['the proof id the priming names', text.replace('the proof you were primed for', `proof ${rowNonce.slice(-16)}`), ['probe-names-row-nonce', 'probe-not-conditional-wording']],
    ['the ack and the row nonce, as the priming asks', `${text} TARGET-ACK ${rowNonce}`, ['probe-names-ack', 'probe-names-row-nonce', 'probe-not-conditional-wording']],
    ['the unconditional probe at 4f86dd78', `[k6-proof-harness] ${RRA_ROW} probe ${probeNonce}: reply exactly PROBE-OK ${probeNonce}.`, ['probe-not-conditional-wording']],
    ['🌊\'s wording without the harness header', `${ruled} Otherwise reply exactly PROBE-OK ${probeNonce}.`, ['probe-not-conditional-wording']],
    ['another probe\'s nonce', rraProbeText('RCDRA-PROBE-other'), ['probe-nonce-missing', 'probe-not-conditional-wording']],
    ['the probe nonce run on into another', text.replace(`PROBE-OK ${probeNonce}.`, `PROBE-OK ${probeNonce}x.`), ['probe-nonce-missing', 'probe-not-conditional-wording']],
  ]) {
    assert.deepEqual(rraProbeTextProblems(bad, options), codes, label);
  }
  assert.deepEqual(rraProbeTextProblems(text, { probeNonce }), ['row-nonce-unknown'], 'no row nonce: its absence cannot be shown');
  assert.deepEqual(rraProbeTextProblems(text, { rowNonce }), ['probe-nonce-missing', 'probe-not-conditional-wording']);
  for (const nothing of ['', null, undefined, 42]) assert.deepEqual(rraProbeTextProblems(nothing, options), ['probe-text-missing'], String(nothing));
  // The proof id is the task marker's suffix, the manifest's {{nonceSuffix16}}.
  assert.equal(rraProofId(rowNonce), '0000010-abcdefgh');
  assert.equal(rraProofId('short'), null);
  // The receipt's binding: the hash of this text, its nonce written as the slot.
  assert.equal(RRA_PROBE_TEXT_SHA256, createHash('sha256').update(rraProbeText(RRA_PROBE_NONCE_SLOT)).digest('hex'));
  assert.equal(createHash('sha256').update(text.replaceAll(probeNonce, RRA_PROBE_NONCE_SLOT)).digest('hex'), RRA_PROBE_TEXT_SHA256);
  // The scenario sends the probe through both, and refuses a text that fails the text test.
  const scenario = readFileSync(path.join(k6Root, 'scenarios', 'r-cd-recipient-authority.js'), 'utf8');
  assert.match(scenario, /const instruction = rraProbeText\(probeNonce\);\s+const problems = rraProbeTextProblems\(instruction, \{ rowNonce, probeNonce \}\);\s+if \(problems\.length\) \{\s+refuse\(/);
  assert.doesNotMatch(scenario, /reply exactly \$\{RRA_PROBE_MARKER\}/, 'the unconditional probe is gone');
});

// 🌊, same ruling: "an allowed-silent return → exactly one ACK/no forced PROBE-OK. … The old receipt
// remains `probe-ack-unobserved`, not PASS."
test('the conditional probe\'s grading: a refusal on PROBE-OK and no ack, allowed-silent on the ack, never both required, and the old receipt stays probe-ack-unobserved', () => {
  // allowed-silent: the ack alone passes, and so does the ack beside PROBE-OK.
  for (const probeReplied of [false, true]) {
    const silent = mutate(completeRecord('allowed-silent'), (r) => { r.target.probeReplied = probeReplied; });
    assert.deepEqual(gradeRecipientAuthorityCase(silent), { verdict: 'PASS-candidate', missing: [], contradictions: [], partial: [] }, String(probeReplied));
  }
  // 🕯's allowed-silent shape (rra-88e4fd22f0b122a8): the probe ran and answered PROBE-OK, and no
  // run acked. Read under the conditional probe it is MISSING probe-ack-unobserved; with no probe
  // hash it is unbound as well. Never upgraded either way.
  const old = mutate(completeRecord('allowed-silent'), (r) => {
    Object.assign(r.target, { probeRan: true, probeReplied: true, ackRuns: 0, probeAckRows: 0, foreignRuns: 0, adoptedDeliveryRows: 0 });
  });
  assert.deepEqual(gradeRecipientAuthorityCase(old), { verdict: 'MISSING-candidate', missing: ['probe-ack-unobserved'], contradictions: [], partial: [] });
  const unhashed = mutate(old, (r) => { delete r.target.probeTextSha256; });
  assert.deepEqual(gradeRecipientAuthorityCase(unhashed), { verdict: 'MISSING-candidate', missing: ['probe-text-unbound', 'probe-ack-unobserved'], contradictions: [], partial: [] });
  // As the control at docs 935898d1 sealed it: no probeAckRows, primingAckRows or uncreditedAckRows
  // (needed since 8b3b68b7) and no probe hash. The transcript reads as unread: still never PASS.
  const sealed = mutate(unhashed, (r) => { delete r.target.probeAckRows; delete r.target.primingAckRows; delete r.target.uncreditedAckRows; });
  assert.deepEqual(gradeRecipientAuthorityCase(sealed), { verdict: 'MISSING-candidate', missing: ['transcript-not-read', 'probe-text-unbound'], contradictions: [], partial: [] });
  // Every refusal, the continue_work case's included: PROBE-OK and no ack passes; no PROBE-OK is the
  // probe turn unobserved; an ack, with or without PROBE-OK, is the refused return adopted.
  for (const caseId of RRA_CASE_IDS.filter((id) => RRA_CASES[id].family === 'refusal')) {
    assert.equal(gradeRecipientAuthorityCase(completeRecord(caseId)).verdict, 'PASS-candidate', caseId);
    const silentProbe = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.probeReplied = false; }));
    assert.deepEqual([silentProbe.verdict, silentProbe.missing], ['MISSING-candidate', ['probe-turn-unobserved']], caseId);
    if (RRA_CASES[caseId].tool) continue;
    for (const probeReplied of [true, false]) {
      const acked = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.probeReplied = probeReplied; r.target.probeAckRows = 1; r.target.ackRuns = 1; }));
      assert.equal(acked.verdict, 'FAIL-candidate', `${caseId} ${probeReplied}`);
      assert.deepEqual(acked.contradictions, ['refused-return-adopted'], `${caseId} ${probeReplied}`);
    }
  }
});

// Review finding (conditional-probe lane): no receipt said which probe it sent, and --docs-sha is the
// operator's word. A probing case's receipt now names its probe by the text's hash.
test('a probe that ran is bound to the conditional text by its hash: unbound or another probe is never PASS, a contradiction is still FAIL', () => {
  const unconditional = createHash('sha256').update(`[k6-proof-harness] ${RRA_ROW} probe ${RRA_PROBE_NONCE_SLOT}: reply exactly PROBE-OK ${RRA_PROBE_NONCE_SLOT}.`).digest('hex');
  const probing = RRA_CASE_IDS.filter((id) => RRA_CASES[id].family === 'refusal' || RRA_CASES[id].probeAdopts);
  assert.equal(probing.length, 11);
  for (const caseId of probing) {
    for (const [label, value] of [['no hash', undefined], ['null', null], ['the unconditional probe', unconditional], ['not a hash', 'abc']]) {
      const graded = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.probeTextSha256 = value; }));
      assert.deepEqual([graded.verdict, graded.missing, graded.contradictions], ['MISSING-candidate', ['probe-text-unbound'], []], `${caseId} ${label}`);
    }
    // A probe that never ran is already probe-turn-unobserved; it is not unbound as well.
    const unrun = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.probeRan = false; r.target.probeTextSha256 = null; }));
    assert.ok(unrun.missing.includes('probe-turn-unobserved') && !unrun.missing.includes('probe-text-unbound'), `${caseId}: ${unrun.missing}`);
  }
  // The binding only adds MISSING: an unbound refusal that acked is still FAIL, and so is an unbound
  // probing case whose target was woken (review finding: the work case and allowed-silent too).
  for (const caseId of refusalCases) {
    const acked = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.probeTextSha256 = null; r.target.probeAckRows = 1; r.target.ackRuns = 1; }));
    assert.equal(acked.verdict, 'FAIL-candidate', caseId);
    assert.deepEqual(acked.contradictions, ['refused-return-adopted'], caseId);
  }
  for (const [caseId, code] of [['work-revoked-visibility', 'target-woken'], ['allowed-silent', 'silent-return-woke-target'], ...refusalCases.map((id) => [id, 'target-woken'])]) {
    const woken = gradeRecipientAuthorityCase(mutate(completeRecord(caseId), (r) => { r.target.probeTextSha256 = null; r.target.foreignRuns = 1; }));
    assert.equal(woken.verdict, 'FAIL-candidate', `${caseId}: ${JSON.stringify(woken)}`);
    assert.ok(woken.contradictions.includes(code), `${caseId}: ${woken.contradictions}`);
  }
  // The cases that read the wake's own ack send no probe and need no binding.
  for (const caseId of RRA_CASE_IDS.filter((id) => !probing.includes(id))) {
    assert.equal(completeRecord(caseId).target.probeTextSha256, null, caseId);
    assert.equal(gradeRecipientAuthorityCase(completeRecord(caseId)).verdict, 'PASS-candidate', caseId);
  }
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
  assert.deepEqual(quiet, {
    ackRuns: 0,
    wakeAckRuns: 0,
    probeAckRows: 0,
    primingAckRows: 1,
    uncreditedAckRows: 0,
    foreignRuns: 0,
    unattributedAssistantRows: 0,
    returnMarkerRows: 0,
    probeReplied: true,
    adoptedDeliveryRows: 0,
  }, 'the priming run\'s ack is counted apart, never as an ack of the return');
  const marked = [...messages, { role: 'user', content: [{ type: 'text', text: 'probe' }], __openclaw: { sessionDeliveryAckIds: ['q-1'] } }];
  assert.equal(observeTargetTranscript(marked, { nonce, primingRunIds: ['run-prime'] }).adoptedDeliveryRows, 1, 'the product marker is still counted, as a contradiction check');
  const woken = observeTargetTranscript([...messages, say(`TARGET-ACK ${nonce}`, 'run-wake')], { nonce, primingRunIds: ['run-prime'] });
  assert.equal(woken.ackRuns, 1);
  assert.equal(woken.probeAckRows, 0, 'no probe run, no probe ack');
  assert.equal(woken.foreignRuns, 2, 'the probe run is foreign without a probeRunId');
  const probeOpts = { nonce, primingRunIds: ['run-prime'], probeRunId: 'run-probe', probeNonce: 'probe-1' };
  const inProbe = observeTargetTranscript([...messages, say(`TARGET-ACK ${nonce}`, 'run-probe')], probeOpts);
  assert.equal(inProbe.ackRuns, 1, 'an ack in the probe run is the return adopted into the probe turn');
  assert.equal(inProbe.probeAckRows, 1);
  assert.equal(inProbe.wakeAckRuns, 0, 'the probe run\'s ack is never a wake turn\'s');
  assert.equal(inProbe.foreignRuns, 0);
  // Two ack rows in the probe run are two rows, one run.
  const twice = observeTargetTranscript([...messages, say(`TARGET-ACK ${nonce}`, 'run-probe'), say(`TARGET-ACK ${nonce}`, 'run-probe')], probeOpts);
  assert.equal(twice.probeAckRows, 2);
  assert.equal(twice.ackRuns, 1);
  // An ack in a wake run is not the probe run's.
  const elsewhere = observeTargetTranscript([...messages, say(`TARGET-ACK ${nonce}`, 'run-wake')], probeOpts);
  assert.deepEqual([elsewhere.ackRuns, elsewhere.wakeAckRuns, elsewhere.probeAckRows, elsewhere.foreignRuns], [1, 1, 0, 1]);
  // An ack in both is one wake run and the probe run: two runs, one of them a wake turn's.
  const both = observeTargetTranscript([...messages, say(`TARGET-ACK ${nonce}`, 'run-wake'), say(`TARGET-ACK ${nonce}`, 'run-probe')], probeOpts);
  assert.deepEqual([both.ackRuns, both.wakeAckRuns, both.probeAckRows, both.foreignRuns], [2, 1, 1, 1]);
  // Another nonce after the marker, or none, is never this case's ack; it is counted apart.
  for (const text of ['TARGET-ACK probe-1', 'TARGET-ACK RCDRA-1-abcd', 'TARGET-ACK', `TARGET-ACK ${nonce}\nTARGET-ACK RCDRA-2-xyz`]) {
    const other = observeTargetTranscript([...messages, say(text, 'run-probe')], probeOpts);
    assert.equal(other.uncreditedAckRows, 1, text);
    assert.equal(other.probeAckRows, text.includes(`${nonce}\n`) ? 1 : 0, text);
  }
  assert.equal(observeTargetTranscript([...messages, say(`TARGET-ACKED ${nonce}`, 'run-probe')], probeOpts).uncreditedAckRows, 0, 'another word is no ack');
  // Review finding (target-ack lane): a row quoting the harness prompt is never credited as an ack,
  // so an ack marker in it, with any nonce, is one the case cannot read; it is no longer skipped.
  for (const text of [`[k6-proof-harness] TARGET-ACK x`, `[k6-proof-harness] probe: TARGET-ACK ${nonce}`]) {
    const quoted = observeTargetTranscript([...messages, say(`TARGET-ACK ${nonce}`, 'run-probe'), say(text, 'run-probe')], probeOpts);
    assert.deepEqual([quoted.probeAckRows, quoted.uncreditedAckRows], [1, 1], text);
  }
  assert.equal(observeTargetTranscript([...messages, say('[k6-proof-harness] probe: PROBE-OK probe-1', 'run-probe')], probeOpts).uncreditedAckRows, 0, 'no ack marker, nothing unread');
  // A probe run id that is also a priming run's names no probe run: nothing in it is the probe's.
  const shared = observeTargetTranscript([...messages, say(`TARGET-ACK ${nonce}`, 'run-prime')], { ...probeOpts, probeRunId: 'run-prime' });
  assert.deepEqual([shared.probeAckRows, shared.primingAckRows, shared.probeReplied], [0, 2, false]);
  const heartbeat = [
    ...messages,
    { role: 'assistant', content: [{ type: 'toolCall', id: 'hb-1', name: 'heartbeat_respond', arguments: { outcome: 'done', notify: true, summary: `TARGET-ACK ${nonce}` } }], __openclaw: { runId: 'run-hb' } },
    { role: 'toolResult', toolCallId: 'hb-1', toolName: 'heartbeat_respond', content: [{ type: 'text', text: JSON.stringify({ status: 'accepted', summary: `TARGET-ACK ${nonce}` }) }], __openclaw: { runId: 'run-hb' } },
  ];
  assert.equal(observeTargetTranscript(heartbeat, { nonce, primingRunIds: ['run-prime'], probeRunId: 'run-probe' }).ackRuns, 1);
  // A heartbeat_respond receipt in the probe run is one probe ack.
  const inRun = (rows, runId) => rows.map((row) => (row.__openclaw?.runId === 'run-hb' ? { ...row, __openclaw: { runId } } : row));
  assert.equal(observeTargetTranscript(inRun(heartbeat, 'run-probe'), probeOpts).probeAckRows, 1);
  // Review finding (target-ack lane): one in a priming run is a priming ack, never the return's.
  const primingHeartbeat = observeTargetTranscript(inRun(heartbeat, 'run-prime'), probeOpts);
  assert.deepEqual([primingHeartbeat.primingAckRows, primingHeartbeat.ackRuns, primingHeartbeat.probeAckRows], [2, 0, 0], 'the text ack and the heartbeat ack of the priming run');
  // ... and a heartbeat_respond call with another nonce is an unclean ack.
  const otherHeartbeat = inRun(heartbeat, 'run-probe').map((row) => (row.role === 'assistant' && row.__openclaw?.runId === 'run-probe'
    ? { ...row, content: [{ ...row.content[0], arguments: { ...row.content[0].arguments, notificationText: 'TARGET-ACK RCDRA-9-zzz' } }] }
    : row));
  assert.equal(observeTargetTranscript(otherHeartbeat, probeOpts).uncreditedAckRows, 1);
  // Re-review finding (target-ack lane): heartbeat acks are counted per call. Two calls in one row, or
  // two calls before their results, are two acks, never one.
  const hbCall = (id) => ({ type: 'toolCall', id, name: 'heartbeat_respond', arguments: { outcome: 'done', notify: true, summary: `TARGET-ACK ${nonce}` } });
  const hbResult = (id, runId, extra = {}) => ({ role: 'toolResult', toolCallId: id, toolName: 'heartbeat_respond', content: [{ type: 'text', text: JSON.stringify({ status: 'accepted', summary: `TARGET-ACK ${nonce}`, ...extra }) }], __openclaw: { runId }, ...(extra.isError ? { isError: true } : {}) });
  const oneRow = [...messages, { role: 'assistant', content: [hbCall('a'), hbCall('b')], __openclaw: { runId: 'run-probe' } }, hbResult('a', 'run-probe'), hbResult('b', 'run-probe')];
  assert.deepEqual([observeTargetTranscript(oneRow, probeOpts).probeAckRows, observeTargetTranscript(oneRow, probeOpts).ackRuns], [2, 1]);
  const interleaved = [...messages, { role: 'assistant', content: [hbCall('a')], __openclaw: { runId: 'run-probe' } }, { role: 'assistant', content: [hbCall('b')], __openclaw: { runId: 'run-probe' } }, hbResult('a', 'run-probe'), hbResult('b', 'run-probe')];
  assert.equal(observeTargetTranscript(interleaved, probeOpts).probeAckRows, 2);
  // ... and an exact ack in a call no accepted result binds (an error result, none, or another run's)
  // is an ack this case cannot credit, never silence.
  for (const [label, tail] of [
    ['error result', [hbResult('a', 'run-probe', { isError: true, status: 'error' })]],
    ['no result', []],
    ['result from another run', [hbResult('a', 'run-other')]],
  ]) {
    const unbound = observeTargetTranscript([...messages, { role: 'assistant', content: [hbCall('a')], __openclaw: { runId: 'run-probe' } }, ...tail], probeOpts);
    assert.deepEqual([unbound.probeAckRows, unbound.ackRuns, unbound.uncreditedAckRows], [0, 0, 1], label);
  }
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
    // Nor do the interim pin or the merged head before the delegate dispatch grant.
    ['candidate-not-pinned', {}, (o) => ({ ...o, candidateSha: INTERIM }), {}],
    ['candidate-not-pinned', {}, (o) => ({ ...o, candidateSha: PRE_GRANT }), {}],
    ['stage-build-mismatch', { buildCommit: 'f15237ec921879d918482cdf372b0718d4c1aab9' }, (o) => o, {}],
    ['stage-build-mismatch', { buildCommit: RRA_J12 }, (o) => o, {}],
    ['stage-build-mismatch', { buildCommit: PRE_GRANT }, (o) => o, {}],
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
    pre_transition_obs: { ackRuns: 0, probeAckRows: 0, primingAckRows: 0, uncreditedAckRows: 0, foreignRuns: 0, unattributedAssistantRows: 0, returnMarkerRows: 0, probeReplied: false, adoptedDeliveryRows: 0 },
    child: { spawned: true, bound: true, done: true, key: CHILD_KEY },
    transition: { method: 'session.visibility.set', ok: true, requested_at_ms: 5_000, settled_at_ms: 5_100 },
    probe_ran: true,
    probe_sent_at_ms: 59_000,
    probe_text_sha256: RRA_PROBE_TEXT_SHA256,
    target_obs: { ackRuns: 0, probeAckRows: 0, primingAckRows: 0, uncreditedAckRows: 0, foreignRuns: 0, unattributedAssistantRows: 0, returnMarkerRows: 0, probeReplied: true, adoptedDeliveryRows: 0 },
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
  // The control saw the park line at 3 s and released the transition at 4 s.
  const witness = { parkedCopyAtMs: 3_000, releasedAtMs: 4_000 };
  const record = assembleCaseRecord({
    caseId: 'revoked-visibility',
    runId: RUN,
    docsSha: 'd'.repeat(40),
    gates: completeRecord('allowed').gates,
    evidence,
    witness,
    ...harness,
    generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }],
    cleanup: { gatewayStopped: true, residue: false },
    startedAtMs: 500,
  });
  assert.equal(record.park.deliveredToTargetAtMs, 3_000);
  assert.equal(record.park.deliveredFromChildAtMs, 3_000, 'the park line names the target and comes from the case\'s child');
  assert.deepEqual(record.witness, witness, 'the control\'s witness of that line, before it released the transition');
  assert.deepEqual(record.routing, { duringTransition: 0, afterTransition: 0 }, 'the park line precedes the transition');
  assert.equal(record.target.probeSentAtMs, 59_000);
  assert.equal(record.target.probeTextSha256, RRA_PROBE_TEXT_SHA256, 'the probe the scenario sent, by its text\'s hash');
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
  const assemble = (logEntries, extra = {}) => assembleCaseRecord({ caseId: 'revoked-visibility', runId: RUN, docsSha: 'd'.repeat(40), gates: completeRecord('allowed').gates, evidence: { ...evidence, ...extra }, witness, logEntries, timeline: harness.timeline, generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }], cleanup: { gatewayStopped: true, residue: false }, startedAtMs: 500 });
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
    target_obs: { ackRuns: 1, probeAckRows: 0, primingAckRows: 0, uncreditedAckRows: 0, foreignRuns: 1, unattributedAssistantRows: 0, returnMarkerRows: 0, probeReplied: false, adoptedDeliveryRows: 0 },
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
      const correlation = { schema: 'openclaw.k6.continuation-trace-correlation.v1', row: RRA_ROW, reason: { hash: 'abcdef0123456789', length: 120 }, traceId: TRACE_ID, traceJson: `tempo-trace-${TRACE_ID.slice(0, 12)}.json`, delegate: { mode: RRA_CASES[caseId].mode } };
      if (RRA_CASES[caseId].expectChild !== false) writeFileSync(path.join(dir, caseId, 'continuation-trace-correlation.json'), JSON.stringify(correlation));
    }
    assert.equal(gradeRowFromArtifacts(dir, key).verdict, 'PASS-candidate');
    writeFileSync(path.join(dir, 'allowed', 'continuation-trace-correlation.json'), JSON.stringify({ schema: 'openclaw.k6.continuation-trace-correlation.v1', row: RRA_ROW, reason: { hash: 'ffffffffffffffff', length: 120 }, traceId: TRACE_ID, traceJson: `tempo-trace-${TRACE_ID.slice(0, 12)}.json`, delegate: { mode: 'silent-wake' } }));
    assert.equal(gradeRowFromArtifacts(dir, key).verdict, 'PARTIAL-candidate', 'another case\'s trace is no trace');
    rmSync(path.join(dir, 'reassigned'), { recursive: true });
    assert.equal(gradeRowFromArtifacts(dir, key).verdict, 'MISSING-candidate');
    assert.equal(gradeRowFromArtifacts(dir, 'x'.repeat(40)).verdict, 'MISSING-candidate', 'nothing verifies under another key');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const good = { schema: 'openclaw.k6.continuation-trace-correlation.v1', row: RRA_ROW, reason: { hash: 'abcdef0123456789', length: 120 }, traceId: TRACE_ID, traceJson: `tempo-trace-${TRACE_ID.slice(0, 12)}.json`, delegate: { mode: 'silent-wake' } };
  assert.equal(traceCorrelationMatches(completeRecord('allowed'), good), true);
  // The trace was matched by the mode the case dispatched, never another case's or the manifest's.
  assert.equal(traceCorrelationMatches(completeRecord('allowed'), { ...good, delegate: { mode: 'silent' } }), false, 'another mode');
  assert.equal(traceCorrelationMatches(completeRecord('allowed'), { ...good, delegate: undefined }), false, 'no recorded mode');
  assert.equal(traceCorrelationMatches(completeRecord('revoked-visibility'), { ...good, delegate: { mode: 'silent' } }), true, 'a silent case');
  assert.equal(traceCorrelationMatches(completeRecord('revoked-visibility'), good), false, 'a silent case collected as silent-wake');
  assert.equal(traceCorrelationMatches(completeRecord('allowed'), { ...good, row: 'R-CD-4' }), false);
  assert.equal(traceCorrelationMatches(completeRecord('allowed'), { ...good, traceId: undefined }), false, 'no trace id, no trace');
  assert.equal(traceCorrelationMatches(completeRecord('allowed'), { ...good, traceJson: 'tempo-trace-000000000000.json' }), false, 'a trace file that is not its own');
});

// Review finding (target-ack lane): the scenario read OPENCLAW_RCD_RA_PROBE_SETTLE_MS, but the control
// builds k6's environment from its own list, so the knob never reached k6.
test('every timing knob the scenario reads reaches k6 through the control, and only a positive integer', () => {
  const scenario = readFileSync(path.join(k6Root, 'scenarios', 'r-cd-recipient-authority.js'), 'utf8');
  const read = [...new Set([...scenario.matchAll(/numberEnv\('(OPENCLAW_RCD_RA_[A-Z_]+)'/gu)].map((match) => match[1]))].sort();
  assert.ok(read.includes('OPENCLAW_RCD_RA_PROBE_SETTLE_MS'), read.join(','));
  const env = Object.fromEntries(read.map((key) => [key, '1234']));
  assert.deepEqual(Object.keys(parseArgs([], env).timing).sort(), read);
  assert.throws(() => parseArgs([], { OPENCLAW_RCD_RA_PROBE_SETTLE_MS: '0' }), /positive integer/);
  assert.throws(() => parseArgs([], { OPENCLAW_RCD_RA_PROBE_SETTLE_MS: '10s' }), /positive integer/);
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
  // The row's gates come first: a record of the interim pin or the pre-grant head is not about j12′.
  for (const fn of [INTERIM, PRE_GRANT].flatMap((old) => [(r) => { r.candidateSha = old; }, (r) => { r.gates.buildInfoCommit = old; }])) {
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

// The witness for reassigned's prompt-drain ordering: the pending sweep's arming line
// (session-delivery-queue-runtime.ts:480-484 at 2907e656), logged by the gateway's
// session-delivery-recovery child (server-runtime-services.ts:441; server-kernel.ts:36), whose console
// tag drops the gateway prefix (src/logging/subsystem.ts:62, 106-120).
test('the pending sweep\'s arming line is read from the console or the structured file log, and nothing else', () => {
  const message = 'session delivery: periodic sweep armed 1 pending entry that no runtime had scheduled';
  for (const line of [
    `[session-delivery-recovery] ${message}`,
    `08:00:00.000 [session-delivery-recovery] ${message}`,
    `08:00:00 [session-delivery-recovery] ${message}`,
    `2026-11-04T14:23:17.500+00:00 [session-delivery-recovery] ${message}`,
    `\u001b[90m08:00:00.000\u001b[39m \u001b[36m[session-delivery-recovery]\u001b[39m \u001b[36m${message}\u001b[39m`,
    JSON.stringify({ time: '2026-11-04T14:23:17.500Z', level: 'info', subsystem: 'gateway/session-delivery-recovery', message }),
    JSON.stringify({ 0: JSON.stringify({ subsystem: 'gateway/session-delivery-recovery' }), 1: message, _meta: { name: JSON.stringify({ subsystem: 'gateway/session-delivery-recovery' }), logLevelName: 'INFO' } }),
  ]) assert.deepEqual(parseSweepArmedLine(line), { armed: 1 }, line);
  assert.deepEqual(parseSweepArmedLine('[session-delivery-recovery] session delivery: periodic sweep armed 3 pending entries that no runtime had scheduled'), { armed: 3 });
  for (const line of [
    // Another subsystem quoting the text, a reply echoing it, a partial or a zero count.
    `[gateway] ${message}`,
    // Another subsystem's line that quotes the sweep's whole console line: only a timestamp may
    // precede the tag (review finding).
    `[agent/embedded] [session-delivery-recovery] ${message}`,
    `reply: [session-delivery-recovery] ${message}`,
    `[agent/embedded] reply: "${message}"`,
    `[session-delivery-recovery] session delivery: periodic sweep armed 1 pending entry`,
    `[session-delivery-recovery] session delivery: periodic sweep armed 0 pending entries that no runtime had scheduled`,
    JSON.stringify({ subsystem: 'gateway/other', message }),
    JSON.stringify({ 0: JSON.stringify({ subsystem: 'gateway/other' }), 1: message }),
    '',
    undefined,
  ]) assert.equal(parseSweepArmedLine(line), null, String(line));
});

test('the control counts sweep arming lines only while the transition was in flight', () => {
  const evidence = revokedEvidence();
  const harness = revokedHarness(evidence);
  const sweepLine = (atMs) => ({ atMs, text: '[session-delivery-recovery] session delivery: periodic sweep armed 1 pending entry that no runtime had scheduled', generation: 0 });
  const { requested_at_ms: requested, settled_at_ms: settled } = evidence.transition;
  assert.ok(settled > requested);
  const assemble = (lines) => assembleCaseRecord({ caseId: 'revoked-visibility', runId: RUN, docsSha: 'd'.repeat(40), gates: completeRecord('allowed').gates, evidence, logEntries: [...harness.logEntries, ...lines], timeline: harness.timeline, generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }], cleanup: { gatewayStopped: true, residue: false }, startedAtMs: 500 });
  assert.deepEqual(assemble([]).sweep, { armedInTransition: 0 });
  assert.deepEqual(assemble([sweepLine(requested), sweepLine(settled)]).sweep, { armedInTransition: 2 }, 'both ends count');
  assert.deepEqual(assemble([sweepLine(requested - 1), sweepLine(settled + 1)]).sweep, { armedInTransition: 0 }, 'before and after do not');
  const unsettled = assembleCaseRecord({ caseId: 'revoked-visibility', runId: RUN, docsSha: 'd'.repeat(40), gates: completeRecord('allowed').gates, evidence: { ...evidence, transition: { ...evidence.transition, settled_at_ms: null } }, logEntries: [sweepLine(requested)], timeline: harness.timeline, generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }], cleanup: { gatewayStopped: true, residue: false }, startedAtMs: 500 });
  assert.deepEqual(unsettled.sweep, { armedInTransition: null }, 'no span, no count');
  assert.equal(assembleCaseRecord({ caseId: 'allowed', runId: RUN, docsSha: 'd'.repeat(40), gates: completeRecord('allowed').gates, evidence, logEntries: [], timeline: [], generations: [], cleanup: { gatewayStopped: true, residue: false }, startedAtMs: 500 }).sweep, null, 'an allowed case records none');
  // A delete and re-create: the span ends at the delete's own response. A sweep while the create is
  // in flight reads an epoch the delete already advanced, so it can only refuse (review finding).
  const reassign = (deleteSettled, lines) => assembleCaseRecord({ caseId: 'reassigned', runId: RUN, docsSha: 'd'.repeat(40), gates: completeRecord('allowed').gates, evidence: { ...evidence, transition: { ...evidence.transition, method: 'sessions.delete+sessions.create', delete_settled_at_ms: deleteSettled } }, logEntries: [...harness.logEntries, ...lines], timeline: harness.timeline, generations: [{ index: 0, startedByHarness: true, ownedListenerThroughout: true }], cleanup: { gatewayStopped: true, residue: false }, startedAtMs: 500 });
  const deleteSettled = requested + 50;
  assert.ok(deleteSettled < settled);
  assert.deepEqual(reassign(deleteSettled, [sweepLine(requested + 20)]).sweep, { armedInTransition: 1 }, 'a sweep inside the delete');
  assert.deepEqual(reassign(deleteSettled, [sweepLine(deleteSettled)]).sweep, { armedInTransition: 1 }, 'up to the delete\'s response');
  assert.deepEqual(reassign(deleteSettled, [sweepLine(deleteSettled + 1), sweepLine(settled)]).sweep, { armedInTransition: 0 }, 'a sweep during the create does not count');
  assert.deepEqual(reassign(undefined, [sweepLine(requested + 20)]).sweep, { armedInTransition: null }, 'no delete response recorded, no count');
  assert.equal(reassign(deleteSettled, []).transition.deleteSettledAtMs, deleteSettled);
  assert.equal(Object.hasOwn(assemble([]).transition, 'deleteSettledAtMs'), false, 'only a delete and re-create records it');
});
