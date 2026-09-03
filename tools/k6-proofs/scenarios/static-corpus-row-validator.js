/**
 * Generic offline/static current-corpus validator for manual Project 81 rows.
 *
 * The row manifest selects the row via rowId. This validates committed PROOFS
 * receipts only; it does not connect to a gateway, fire continuation tools,
 * mutate config, or claim fresh live behavior.
 */
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';
import {
  boundaryProducerSelectionFailureCode,
  selectReviewedBoundaryProducer,
  validateBoundaryProducerReceiptSet,
} from '../lib/static-boundary-producer-receipts.mjs';

export const options = {
  scenarios: { static_corpus_row_validator: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '15s' } },
  thresholds: { proof_failures: ['count==0'], static_corpus_row_duration: ['p(95)<10000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('static_corpus_row_duration');
const manifest = loadManifestFromEnv();
const index = JSON.parse(open('../../../PROOFS/INDEX.json'));
const currentSha = index.current_sha;
const carriedFrom = index.carried_from || currentSha;
const sourceEvidenceSha = index.static_evidence_sha || currentSha;

function includesAny(text, needles) { return needles.some((needle) => text.includes(needle)); }
function allPresent(obj) { return Object.values(obj).every(Boolean); }
function rowRoot(row) { return `../../../PROOFS/${sourceEvidenceSha}/${row}/cael-dgx`; }
function readMaybe(path) { try { return open(path); } catch (e) { return ''; } }
function readJsonMaybe(path) {
  const raw = readMaybe(path);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function loadBoundaryProducer(rowId) {
  try {
    const currentProofManifest = readJsonMaybe(
      `../../../PROOFS/${currentSha}/proofs-manifest.json`,
    );
    if (!currentProofManifest) throw new Error('current proofs manifest is unavailable');
    const selection = selectReviewedBoundaryProducer({
      proofsManifest: currentProofManifest,
      rowId,
      candidateSha: currentSha,
    });
    const receipts = {};
    const sourceFiles = {};
    for (const file of selection.files) {
      const source = `${selection.relativeRoot}/${file}`;
      receipts[file] = readJsonMaybe(source);
      sourceFiles[file] = source;
    }
    return {
      selection,
      sourceFiles,
      validation: validateBoundaryProducerReceiptSet({
        rowId,
        candidateSha: currentSha,
        receipts,
      }),
    };
  } catch (error) {
    const failureCode = boundaryProducerSelectionFailureCode(error);
    console.error(`Boundary producer selection failed for ${rowId}: ${failureCode}`);
    return {
      selection: null,
      sourceFiles: {},
      failureCode,
      validation: {
        passed: false,
        checks: {},
      },
    };
  }
}

const selectedRow = manifest?.rowId || '';
// R-CW-5A/6A validate the same committed source/harness material as the live
// cap rows, but deliberately emit a construct-only result.  They must never
// be mistaken for a freshly fired R-CW-5/6 cap receipt.
const sourceRow = selectedRow === 'R-CW-5A' ? 'R-CW-5'
  : selectedRow === 'R-CW-6A' ? 'R-CW-6'
    : selectedRow;
const isStaticBoundaryVariant = sourceRow !== selectedRow;
const roots = {
  rcw7: rowRoot('R-CW-7'),
  childLive: rowRoot('R-CW-DELEGATE-CHILD-LIVE'),
  delegateToken: rowRoot('R-CW-DELEGATE-TOKEN'),
  multi: rowRoot('R-CW-MULTI'),
  cdCollection: rowRoot('R-CD-COLLECTION-ON-COLLAPSE'),
  multiCollapse: rowRoot('R-CW-MULTI-COLLAPSE'),
  rcw5: rowRoot('R-CW-5'),
  rcw6: rowRoot('R-CW-6'),
};

const corpus = {};
if (selectedRow === 'R-CW-7') {
  corpus.rcw7 = {
    evidence: readMaybe(`${roots.rcw7}/EVIDENCE.md`),
    testLog: readMaybe(`${roots.rcw7}/test/focused-traceparent-tests.log`),
    sourceSnippets: readMaybe(`${roots.rcw7}/source/source-snippets.md`),
    sourceSha: readMaybe(`${roots.rcw7}/source/source-sha.txt`),
  };
}
if (selectedRow === 'R-CW-DELEGATE-CHILD-LIVE') {
  corpus.childLive = {
    evidence: readMaybe(`${roots.childLive}/EVIDENCE.md`),
    hop1: readMaybe(`${roots.childLive}/hop1.txt`),
    hop2: readMaybe(`${roots.childLive}/hop2.txt`),
    verifier: readMaybe(`${roots.childLive}/verifier-receipt.txt`),
    flow: readMaybe(`${roots.childLive}/flow-runs.json`),
    tempo: readMaybe(`${roots.childLive}/tempo-attribute-receipt.txt`),
  };
}
if (selectedRow === 'R-CW-DELEGATE-TOKEN') {
  corpus.delegateToken = {
    evidence: readMaybe(`${roots.delegateToken}/EVIDENCE.md`),
    childAudit: readMaybe(`${roots.delegateToken}/child-transcript-tool-audit.md`),
    journal: readMaybe(`${roots.delegateToken}/journal-continuation-excerpt.log`),
    flowRows: readMaybe(`${roots.delegateToken}/flow-runs-matching-full.jsonl`),
    toolAudit: readMaybe(`${roots.delegateToken}/tempo-child-tool-audit.txt`),
  };
}
if (selectedRow === 'R-CW-MULTI') {
  corpus.multi = {
    evidence: readMaybe(`${roots.multi}/EVIDENCE.md`),
    sourceReceipts: readMaybe(`${roots.multi}/source-tool-receipts.jsonl`),
    flowRows: readMaybe(`${roots.multi}/flow-runs-final.json`),
    journal: readMaybe(`${roots.multi}/journal-continuation-lines.txt`),
    wakeReceipts: readMaybe(`${roots.multi}/wake-and-folded-receipts.txt`),
    traceSummary: readMaybe(`${roots.multi}/tempo/trace-summary.jsonl`),
  };
}
if (selectedRow === 'R-CD-COLLECTION-ON-COLLAPSE') {
  corpus.cdCollection = {
    evidence: readMaybe(`${roots.cdCollection}/EVIDENCE.md`),
    evaluation: readMaybe(`${roots.cdCollection}/evaluation.json`),
    flowRows: readMaybe(`${roots.cdCollection}/db/flow-rows-concise.json`),
    taskRows: readMaybe(`${roots.cdCollection}/db/task-rows-concise.json`),
    rootReceipt: readMaybe(`${roots.cdCollection}/main/root-collection-receipt.md`),
    journal: readMaybe(`${roots.cdCollection}/journal/filtered.log`),
    traceSummary: readMaybe(`${roots.cdCollection}/tempo/trace-summary.json`),
  };
}
if (selectedRow === 'R-CW-MULTI-COLLAPSE') {
  corpus.multiCollapse = {
    evidence: readMaybe(`${roots.multiCollapse}/EVIDENCE.md`),
    insertVars: readMaybe(`${roots.multiCollapse}/insert-vars.json`),
    postInsert: readMaybe(`${roots.multiCollapse}/post-insert-sqlite.txt`),
    finalTerminal: readMaybe(`${roots.multiCollapse}/final-terminal-sqlite.txt`),
    finalQueued: readMaybe(`${roots.multiCollapse}/final-queued-running.txt`),
    flowRows: readMaybe(`${roots.multiCollapse}/flow-runs-final.json`),
    journal: readMaybe(`${roots.multiCollapse}/journal-continuation-window.txt`),
    restoreHash: readMaybe(`${roots.multiCollapse}/restore-verified-sha256.txt`),
    tempoAttrs: readMaybe(`${roots.multiCollapse}/tempo-attribute-receipt.txt`),
  };
}
if (selectedRow === 'R-CW-5A') {
  corpus.rcw5Producer = loadBoundaryProducer('R-CW-5');
} else if (sourceRow === 'R-CW-5') {
  corpus.rcw5 = {
    evidence: readMaybe(`${roots.rcw5}/EVIDENCE.md`),
    schedulerSource: readMaybe(`${roots.rcw5}/scheduler-source.txt`),
    delegateSource: readMaybe(`${roots.rcw5}/delegate-dispatch-cost-cap-source.txt`),
    announceBracketSource: readMaybe(`${roots.rcw5}/subagent-announce-bracket-cost-cap-source.txt`),
    announceToolSource: readMaybe(`${roots.rcw5}/subagent-announce-tool-cost-cap-source.txt`),
    costCapLog: readMaybe(`${roots.rcw5}/vitest-delegate-dispatch-cost-cap-exhaustion.log`),
    chainGuardLog: readMaybe(`${roots.rcw5}/vitest-chain-guard-cost-cap.log`),
  };
}
if (selectedRow === 'R-CW-6A') {
  corpus.rcw6Producer = loadBoundaryProducer('R-CW-6');
} else if (sourceRow === 'R-CW-6') {
  corpus.rcw6 = {
    evidence: readMaybe(`${roots.rcw6}/EVIDENCE.md`),
    schedulerSource: readMaybe(`${roots.rcw6}/source/scheduler-source-snippet.txt`),
    workDispatchSource: readMaybe(`${roots.rcw6}/source/work-dispatch-source-snippet.txt`),
    schedulerTest: readMaybe(`${roots.rcw6}/source/scheduler-test-snippet.txt`),
    harnessLog: readMaybe(`${roots.rcw6}/harness/scheduler-boundary-harness.log`),
  };
}

function validateRcw7() {
  const root = roots.rcw7;
  const { evidence, testLog, sourceSnippets, sourceSha } = corpus.rcw7;
  const checks = {
    passScope: evidence.includes('PASS') && evidence.includes('runtime traceparent propagation'),
    internalNotPublic: evidence.includes('internal protocol field') && sourceSnippets.includes('x-openclaw-internal'),
    autoPickup: evidence.includes('auto-picks the active runtime trace context') || sourceSnippets.includes('auto-picks the active runtime trace context'),
    dispatchPreserves: evidence.includes('threads persisted traceparent into spawned continuation runs') || sourceSnippets.includes('threads persisted traceparent'),
    childReceives: evidence.includes('forwards inherited traceparent to the child agent run') || sourceSnippets.includes('forwards inherited traceparent'),
    testsPassed: testLog.includes('passed 3 Vitest shards') || evidence.includes('142 passed / 0 failed'),
    sourceSha: sourceSha.includes(sourceEvidenceSha) || evidence.includes(sourceEvidenceSha),
  };
  return { checks, source_files: { evidence: `${root}/EVIDENCE.md`, testLog: `${root}/test/focused-traceparent-tests.log`, sourceSnippets: `${root}/source/source-snippets.md` } };
}

function validateDelegateChildLive() {
  const root = roots.childLive;
  const { evidence, hop1, hop2, verifier, flow, tempo } = corpus.childLive;
  const checks = {
    verdictPass: evidence.includes('Verdict') && evidence.includes('PASS'),
    hop1BeforeWork: hop1.includes('HOP1-WROTE-BEFORE-CONTINUE_WORK'),
    hop2AfterWake: hop2.includes('hop2-EXECUTED after child continuation wake'),
    verifierBoth: verifier.includes('hop1_exists=yes') && verifier.includes('hop2_exists=yes'),
    parentDelegateTrace: tempo.includes('continuation.delegate.dispatch') && tempo.includes('delegate.mode=normal'),
    childWorkFireTrace: tempo.includes('continuation.work.fire') && tempo.includes('delay.ms=5000'),
    flowReceipts: flow.includes('continuation_work') || flow.includes('continuation-work'),
  };
  return { checks, source_files: { evidence: `${root}/EVIDENCE.md`, hop1: `${root}/hop1.txt`, hop2: `${root}/hop2.txt`, verifier: `${root}/verifier-receipt.txt`, tempo: `${root}/tempo-attribute-receipt.txt` } };
}

function validateDelegateToken() {
  const root = roots.delegateToken;
  const { evidence, childAudit, journal, flowRows, toolAudit } = corpus.delegateToken;
  const checks = {
    verdictPass: evidence.includes('Verdict') && evidence.includes('PASS'),
    bareToken: evidence.includes('CONTINUE_WORK:5') && childAudit.includes('CONTINUE_WORK:5'),
    tokenOrigin: journal.includes('origin=bracket kind=work') || evidence.includes('origin=bracket kind=work'),
    noTypedChildTool: includesAny(childAudit, ['no child `toolCall` blocks', 'No child typed `continue_work` tool call']) || evidence.includes('no child `openclaw.tool.execution` span for typed `continue_work`'),
    secondTurn: evidence.includes('Real second child turn') && evidence.includes('Disposition: `granted`'),
    durableWork: flowRows.includes('core/continuation-work') && flowRows.includes('status') && flowRows.includes('succeeded'),
    tempoWorkFire: toolAudit.includes('continuation.work') || evidence.includes('continuation.work.fire'),
  };
  return { checks, source_files: { evidence: `${root}/EVIDENCE.md`, childAudit: `${root}/child-transcript-tool-audit.md`, journal: `${root}/journal-continuation-excerpt.log`, flowRows: `${root}/flow-runs-matching-full.jsonl`, tempoAudit: `${root}/tempo-child-tool-audit.txt` } };
}

function validateRcwMulti() {
  const root = roots.multi;
  const { evidence, sourceReceipts, flowRows, journal, wakeReceipts, traceSummary } = corpus.multi;
  const checks = {
    verdictPass: evidence.includes('PASS') && evidence.includes('fanout/collapse semantics'),
    threeToolReceipts: (sourceReceipts.match(/"status":"scheduled"/g) || []).length >= 3,
    grantedA: flowRows.includes('disposition') && flowRows.includes('granted'),
    foldedBC: (flowRows.match(/folded-active/g) || []).length >= 2,
    journalFolded: journal.includes('continuation:work-folded-active'),
    noInventedMarkers: evidence.includes('No B/C wake markers were invented') || wakeReceipts.includes('folded-active'),
    traceThreeWorkSpans: (traceSummary.match(/continuation.work/g) || []).length >= 3,
  };
  return { checks, source_files: { evidence: `${root}/EVIDENCE.md`, sourceReceipts: `${root}/source-tool-receipts.jsonl`, flowRows: `${root}/flow-runs-final.json`, journal: `${root}/journal-continuation-lines.txt`, traceSummary: `${root}/tempo/trace-summary.jsonl` } };
}


function validateCdCollectionOnCollapse() {
  const root = roots.cdCollection;
  const { evidence, evaluation, flowRows, taskRows, rootReceipt, journal, traceSummary } = corpus.cdCollection;
  const cSentinel = 'RCD_COLLECTION_BCA2B0B_CAEL_20260704_1316_C_REACHED_AFTER_B_FINAL';
  const checks = {
    verdictPass: evidence.includes('Verdict') && evidence.includes('PASS'),
    methodScope: evidence.includes('A→B→delayed-C') && evidence.includes('B finalized before C'),
    bTypedDelegate: evidence.includes('typed `continue_delegate`') && evidence.includes('delaySeconds') && evidence.includes('fanoutMode'),
    cAfterB: evidence.includes('B finalized before C was created') || evidence.includes('B finalized before C was due'),
    cSentinelPresent: evidence.includes(cSentinel) && journal.includes(cSentinel),
    rootCollection: rootReceipt.includes(cSentinel) || evidence.includes('root/main receives or can observe'),
    durableRows: flowRows.includes('core/continuation-delegate') && taskRows.includes('status') && taskRows.includes('succeeded'),
    evaluationPass: evaluation.includes('PASS') || evaluation.includes('pass') || evidence.includes('PASS'),
    tracePresent: traceSummary.includes('ecda443e0038fb9a38fc33a8b98d7d02') || traceSummary.includes('continuation.delegate'),
  };
  return { checks, source_files: { evidence: `${root}/EVIDENCE.md`, evaluation: `${root}/evaluation.json`, flowRows: `${root}/db/flow-rows-concise.json`, taskRows: `${root}/db/task-rows-concise.json`, rootReceipt: `${root}/main/root-collection-receipt.md`, journal: `${root}/journal/filtered.log`, traceSummary: `${root}/tempo/trace-summary.json` } };
}

function validateRcwMultiCollapse() {
  const root = roots.multiCollapse;
  const { evidence, insertVars, postInsert, finalTerminal, finalQueued, flowRows, journal, restoreHash, tempoAttrs } = corpus.multiCollapse;
  const checks = {
    verdictPassScoped: evidence.includes('PASS') && evidence.includes('synthetic-method caveat'),
    syntheticCaveat: evidence.includes('synthetic DB-seeded') && evidence.includes('not realistic chain-depth evidence'),
    twoRowsInserted: postInsert.includes('OLD_STALE') && postInsert.includes('NEWEST should drive') && insertVars.includes('oldFlow') && insertVars.includes('newFlow'),
    oldSuperseded: finalTerminal.includes('superseded') && journal.includes('continuation:work-superseded'),
    newestGranted: finalTerminal.includes('Same-session continuation turn granted') && flowRows.includes('disposition') && flowRows.includes('granted'),
    noRemainingQueued: finalQueued.trim().length === 0,
    configRestored: restoreHash.trim().split('\n').length >= 2 && evidence.includes('restored config byte-identical'),
    tempoExactChain: tempoAttrs.includes('29fa6c15-2dc9-409f-bf48-138e73667da5') && tempoAttrs.includes('continuation.work.fire'),
  };
  return { checks, source_files: { evidence: `${root}/EVIDENCE.md`, insertVars: `${root}/insert-vars.json`, postInsert: `${root}/post-insert-sqlite.txt`, finalTerminal: `${root}/final-terminal-sqlite.txt`, finalQueued: `${root}/final-queued-running.txt`, flowRows: `${root}/flow-runs-final.json`, journal: `${root}/journal-continuation-window.txt`, restoreHash: `${root}/restore-verified-sha256.txt`, tempoAttrs: `${root}/tempo-attribute-receipt.txt` } };
}

function validateRcw5() {
  const root = roots.rcw5;
  const { evidence, schedulerSource, delegateSource, announceBracketSource, announceToolSource, costCapLog, chainGuardLog } = corpus.rcw5;
  const checks = {
    verdictPass: evidence.includes('Verdict') && evidence.includes('PASS'),
    sourceGuard: schedulerSource.includes('costCapTokens') && schedulerSource.includes('cost-capped') && schedulerSource.includes('> config.costCapTokens'),
    delegateRejection: delegateSource.includes('cost cap exceeded') || delegateSource.includes('cost-capped'),
    announceGuards: announceBracketSource.includes('costCapTokens') && announceToolSource.includes('costCapTokens'),
    costCapSuite: costCapLog.includes('5 passed') && costCapLog.includes('rejects dispatch when accumulatedChainTokens exceeds costCapTokens by 1'),
    boundaryAllowed: costCapLog.includes('exact boundary') && (chainGuardLog.includes('2 passed') || evidence.includes('2/2 selected tests')),
    noLiveMutationScope: evidence.includes('does not mutate live config') || evidence.includes('static/source + unit-test evidence'),
  };
  return { checks, source_files: { evidence: `${root}/EVIDENCE.md`, schedulerSource: `${root}/scheduler-source.txt`, delegateSource: `${root}/delegate-dispatch-cost-cap-source.txt`, announceBracketSource: `${root}/subagent-announce-bracket-cost-cap-source.txt`, announceToolSource: `${root}/subagent-announce-tool-cost-cap-source.txt`, costCapLog: `${root}/vitest-delegate-dispatch-cost-cap-exhaustion.log`, chainGuardLog: `${root}/vitest-chain-guard-cost-cap.log` } };
}

function validateRcw6() {
  const root = roots.rcw6;
  const { evidence, schedulerSource, workDispatchSource, schedulerTest, harnessLog } = corpus.rcw6;
  const checks = {
    verdictPass: evidence.includes('Verdict') && evidence.includes('PASS'),
    boundaryPredicate: schedulerSource.includes('allocatedChainHop >= config.maxChainLength') || schedulerSource.includes('currentChainCount >= maxChainLength'),
    earlyReturn: workDispatchSource.includes('scheduled: false') && workDispatchSource.includes('capped: true'),
    schedulerUnitTest: schedulerTest.includes('chain-capped'),
    harnessCapped: harnessLog.includes('"scheduled": false') && harnessLog.includes('"capped": true') && harnessLog.includes('chain-capped'),
    noLiveMutationScope: evidence.includes('does **not** mutate live `openclaw.json`') && evidence.includes('does **not** restart the gateway'),
  };
  return { checks, source_files: { evidence: `${root}/EVIDENCE.md`, schedulerSource: `${root}/source/scheduler-source-snippet.txt`, workDispatchSource: `${root}/source/work-dispatch-source-snippet.txt`, schedulerTest: `${root}/source/scheduler-test-snippet.txt`, harnessLog: `${root}/harness/scheduler-boundary-harness.log` } };
}

function validateBoundaryProducerConsumer(producer) {
  const selected = producer.selection !== null;
  return {
    checks: {
      reviewedCurrentProducerSelected: selected,
      ...(producer.validation?.checks ?? {}),
      reviewedProducerReceiptSetPassed: producer.validation?.passed === true,
    },
    source_files: producer.sourceFiles,
    producer_failure: producer.failureCode ?? null,
  };
}

const validators = {
  'R-CW-7': validateRcw7,
  'R-CW-DELEGATE-CHILD-LIVE': validateDelegateChildLive,
  'R-CW-DELEGATE-TOKEN': validateDelegateToken,
  'R-CW-MULTI': validateRcwMulti,
  'R-CD-COLLECTION-ON-COLLAPSE': validateCdCollectionOnCollapse,
  'R-CW-MULTI-COLLAPSE': validateRcwMultiCollapse,
  'R-CW-5': validateRcw5,
  'R-CW-6': validateRcw6,
  'R-CW-5A': () => validateBoundaryProducerConsumer(corpus.rcw5Producer),
  'R-CW-6A': () => validateBoundaryProducerConsumer(corpus.rcw6Producer),
};

export default function () {
  const started = Date.now();
  if (!manifest?.rowId) { console.error('OPENCLAW_ROW_MANIFEST with rowId is required'); failures.add(1); return; }
  const errors = validateManifest(manifest);
  if (errors.length > 0) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  const validator = validators[manifest.rowId];
  if (!validator) { console.error(`No static validator implemented for ${manifest.rowId}`); failures.add(1); return; }
  const result = validator();
  if (isStaticBoundaryVariant) {
    result.checks.nonLiveBoundary = true;
  }
  const expectedArtifactClass = manifest?.liveRunSafety?.expectedArtifactClass || 'FAIL-candidate';
  const evidence = {
    row: manifest.rowId,
    sourceRow,
    staticBoundaryVariant: isStaticBoundaryVariant,
    manifest_loaded: true,
    candidateSha: manifest.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    currentProofSha: currentSha,
    sourceEvidenceSha,
    carriedFrom,
    started: new Date(started).toISOString(),
    checks: result.checks,
    source_files: result.source_files,
    ...(result.producer_failure ? { producer_failure: result.producer_failure } : {}),
  };
  const ok = allPresent(result.checks);
  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  evidence.verdict = ok ? expectedArtifactClass : 'FAIL-candidate';
  duration.add(evidence.duration_ms);
  const checkSpec = {};
  for (const [name, value] of Object.entries(result.checks)) checkSpec[name] = () => value;
  check(null, checkSpec);
  if (!ok) failures.add(1);
  console.log(`STATIC_CORPUS_ROW_EVIDENCE ${JSON.stringify(evidence)}`);
}

export function handleSummary(data) {
  const failuresCount = data.metrics.proof_failures?.values?.count || 0;
  const row = manifest?.rowId || 'UNKNOWN';
  const expectedArtifactClass = manifest?.liveRunSafety?.expectedArtifactClass || 'FAIL-candidate';
  return { 'static-corpus-row-summary.json': JSON.stringify({ row, sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', verdict: failuresCount === 0 ? expectedArtifactClass : 'FAIL-candidate', metrics: { failures: failuresCount, duration_ms: data.metrics.static_corpus_row_duration?.values || null } }, null, 2) };
}
