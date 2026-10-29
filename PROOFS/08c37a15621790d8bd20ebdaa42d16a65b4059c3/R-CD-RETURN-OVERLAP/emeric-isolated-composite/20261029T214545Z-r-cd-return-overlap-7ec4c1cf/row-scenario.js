/**
 * Scenario: R-CD-RETURN-OVERLAP — offline/static overlap receipt validator.
 *
 * Validates the committed current PROOFS corpus contains the PASS-with-caveat
 * overlap/collection receipts for one silent and one silent-wake delegate return.
 * This is an offline artifact validator: it does not fire delegates, connect to a
 * gateway, mutate config, or claim isolated wake causality.
 */
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { loadManifestFromEnv, validateManifest } from '../lib/manifest-loader.js';

export const options = {
  scenarios: { r_cd_return_overlap_static: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '15s' } },
  thresholds: { proof_failures: ['count==0'], r_cd_return_overlap_duration: ['p(95)<10000'] },
};

const failures = new Counter('proof_failures');
const duration = new Trend('r_cd_return_overlap_duration');
const manifest = loadManifestFromEnv();
const index = JSON.parse(open('../../../PROOFS/INDEX.json'));
const currentSha = index.current_sha;
const sourceEvidenceSha = index.static_evidence_sha || currentSha;
const rowRoot = `../../../PROOFS/${sourceEvidenceSha}/R-CD-RETURN-OVERLAP/cael-dgx`;
const evidenceMd = open(`${rowRoot}/EVIDENCE.md`);
const flowRows = JSON.parse(open(`${rowRoot}/db/flow-rows-concise.json`));
const taskRows = JSON.parse(open(`${rowRoot}/db/task-rows-concise.json`));
const journal = open(`${rowRoot}/journal/journal-filtered.log`);
const tempo = JSON.parse(open(`${rowRoot}/tempo/trace-0d676f84623ebfe6499a324d039ee050-summary.json`));
const silentMarker = 'RCD_RETURN_OVERLAP_BCA2B0B_CAEL_20260704_1521_SILENT_RETURN';
const wakingMarker = 'RCD_RETURN_OVERLAP_BCA2B0B_CAEL_20260704_1521_WAKING_RETURN';

function jsonIncludes(value, needle) {
  return JSON.stringify(value).includes(needle);
}

export default function () {
  const started = Date.now();
  if (manifest) {
    const errors = validateManifest(manifest);
    if (errors.length > 0) console.warn(`Manifest validation warnings: ${errors.join('; ')}`);
  }

  const flowText = JSON.stringify(flowRows);
  const taskText = JSON.stringify(taskRows);
  const evidence = {
    row: 'R-CD-RETURN-OVERLAP',
    manifest_loaded: !!manifest,
    candidateSha: manifest?.candidateSha || __ENV.OPENCLAW_CANDIDATE_SHA || 'unset',
    currentProofSha: currentSha,
    sourceEvidenceSha,
    started: new Date().toISOString(),
    pass_with_caveat_present: evidenceMd.includes('PASS, with wake-causality caveat') && evidenceMd.includes('not claiming isolated wake causality'),
    silent_flow_present: flowText.includes('"silentWake":null') || evidenceMd.includes('mode=silent'),
    silent_wake_flow_present: flowText.includes('silentWake=true') || flowText.includes('"silentWake":true'),
    both_markers_in_tasks: (taskText.includes(silentMarker) && taskText.includes(wakingMarker)) || (evidenceMd.includes(silentMarker) && evidenceMd.includes(wakingMarker)),
    both_targeted_returns_in_journal: journal.includes('[continuation:targeted-return]') && journal.includes(silentMarker) && journal.includes(wakingMarker),
    no_duplicate_storm_claim_present: evidenceMd.includes('no duplicate wake storm') || evidenceMd.includes('no repeated child execution'),
    tempo_trace_present: jsonIncludes(tempo, '0d676f84623ebfe6499a324d039ee050') || jsonIncludes(tempo, 'continuation.delegate.dispatch') || jsonIncludes(tempo, 'continuation.queue'),
    source_files: {
      evidence: `${rowRoot}/EVIDENCE.md`,
      flowRows: `${rowRoot}/db/flow-rows-concise.json`,
      taskRows: `${rowRoot}/db/task-rows-concise.json`,
      journal: `${rowRoot}/journal/journal-filtered.log`,
      tempo: `${rowRoot}/tempo/trace-0d676f84623ebfe6499a324d039ee050-summary.json`,
    },
  };
  const ok = evidence.pass_with_caveat_present && evidence.silent_flow_present && evidence.silent_wake_flow_present && evidence.both_markers_in_tasks && evidence.both_targeted_returns_in_journal && evidence.no_duplicate_storm_claim_present && evidence.tempo_trace_present;
  evidence.ended = new Date().toISOString();
  evidence.duration_ms = Date.now() - started;
  evidence.verdict = ok ? 'PASS-candidate' : 'FAIL-candidate';
  duration.add(evidence.duration_ms);
  check(null, {
    'pass-with-caveat scope present': () => evidence.pass_with_caveat_present,
    'silent flow present': () => evidence.silent_flow_present,
    'silent-wake flow present': () => evidence.silent_wake_flow_present,
    'both markers in task rows': () => evidence.both_markers_in_tasks,
    'both targeted returns in journal': () => evidence.both_targeted_returns_in_journal,
    'no duplicate storm claim present': () => evidence.no_duplicate_storm_claim_present,
    'tempo trace summary present': () => evidence.tempo_trace_present,
  });
  if (!ok) failures.add(1);
  console.log(`R_CD_RETURN_OVERLAP_EVIDENCE ${JSON.stringify(evidence)}`);
}

export function handleSummary(data) {
  const failuresCount = data.metrics.proof_failures?.values?.count || 0;
  return { 'r-cd-return-overlap-summary.json': JSON.stringify({ row: 'R-CD-RETURN-OVERLAP', sha: __ENV.OPENCLAW_CANDIDATE_SHA || 'unset', verdict: failuresCount === 0 ? 'PASS-candidate' : 'FAIL-candidate', metrics: { failures: failuresCount, duration_ms: data.metrics.r_cd_return_overlap_duration?.values || null } }, null, 2) };
}
