// Offline overlap and collection validators bind each marker to its own
// writer's targeted return (karmaterminal/openclaw-bootstrap#1727).
//
// R-CD-RETURN-OVERLAP passed on one `[continuation:targeted-return]` line plus
// both markers anywhere in the journal. R-CD-COLLECTION-ON-COLLAPSE passed on
// the C sentinel anywhere in the journal (its `C_SENTINEL_SCHEDULED=` dispatcher
// line qualifies) and anywhere in the root receipt (whose sessions_history
// reads quote the task text). Every one of those copies is outbound text.
//
// The committed artifacts under PROOFS/1cc8f4e3… do bind each marker to its
// writer and that writer's targeted return, so the real corpus still
// validates. The tests run each validator scenario for real (k6 runtime
// stubbed) from its own scenarios directory, over a temp copy of those
// artifacts and over a copy whose only markers are outbound. The mutated-copy
// tests import nothing added with the fix and run against the pre-fix tree as
// the negative control.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const k6Root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(k6Root, '../..');
const index = JSON.parse(readFileSync(path.join(repoRoot, 'PROOFS/INDEX.json'), 'utf8'));
const staticSha = index.static_evidence_sha || index.current_sha;
const OVERLAP = 'R-CD-RETURN-OVERLAP';
const COLLECTION = 'R-CD-COLLECTION-ON-COLLAPSE';
const SILENT = 'RCD_RETURN_OVERLAP_BCA2B0B_CAEL_20260704_1521_SILENT_RETURN';
const WAKING = 'RCD_RETURN_OVERLAP_BCA2B0B_CAEL_20260704_1521_WAKING_RETURN';
const C_SENTINEL = 'RCD_COLLECTION_BCA2B0B_CAEL_20260704_1316_C_REACHED_AFTER_B_FINAL';

const RUNNER = `
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [k6Root, scenario, manifest] = process.argv.slice(2);
process.chdir(path.join(k6Root, 'scenarios'));
const { runK6Scenario } = await import(pathToFileURL(path.join(k6Root, 'tests/helpers/k6-node-runtime.mjs')));
const { extractEvidence } = await import(pathToFileURL(path.join(k6Root, 'scripts/extract-k6-evidence.mjs')));
const { log } = await runK6Scenario({
  scenarioPath: path.join(k6Root, 'scenarios', scenario),
  gateway: () => [],
  env: { OPENCLAW_ROW_MANIFEST: path.join(k6Root, 'manifests', manifest), OPENCLAW_CANDIDATE_SHA: 'a'.repeat(40) },
});
process.stdout.write(JSON.stringify(extractEvidence(log)));
`;

/** A temp repo with this tree's k6 tooling and the two committed rows; `mutate(rowDir)` edits the copy. */
function tempTree(row, mutate) {
  const dir = mkdtempSync(path.join(tmpdir(), 'offline-return-binding-'));
  cpSync(k6Root, path.join(dir, 'tools/k6-proofs'), { recursive: true });
  mkdirSync(path.join(dir, 'PROOFS'), { recursive: true });
  cpSync(path.join(repoRoot, 'PROOFS/INDEX.json'), path.join(dir, 'PROOFS/INDEX.json'));
  const rowDir = path.join(dir, 'PROOFS', staticSha, row, 'cael-dgx');
  cpSync(path.join(repoRoot, 'PROOFS', staticSha, row, 'cael-dgx'), rowDir, { recursive: true });
  if (mutate) mutate(rowDir);
  writeFileSync(path.join(dir, 'runner.mjs'), RUNNER);
  return dir;
}

function run(dir, scenario, manifest) {
  const out = execFileSync(process.execPath, [path.join(dir, 'runner.mjs'), path.join(dir, 'tools/k6-proofs'), scenario, manifest], { encoding: 'utf8' });
  const records = JSON.parse(out);
  assert.ok(records.length >= 1, 'an evidence record');
  return records[records.length - 1];
}

/** Keep only journal lines that carry no marker from the writer itself; add outbound copies. */
function outboundOnlyJournal(file, markers, extra) {
  const kept = readFileSync(file, 'utf8').split('\n').filter((line) =>
    !markers.some((marker) => line.includes(marker) && !line.includes(`=${marker}`)) && !/(?:^|\s)session:\s+\S+\s*$/.test(line));
  writeFileSync(file, [...kept, ...extra].join('\n'));
}

test('R-CD-RETURN-OVERLAP: the committed journal binds both markers to their own returns', () => {
  const evidence = run(tempTree(OVERLAP), 'r-cd-return-overlap.js', 'r-cd-return-overlap.json');
  assert.equal(evidence.both_targeted_returns_in_journal, true);
  assert.equal(evidence.verdict, 'PASS-candidate');
});

test('R-CD-RETURN-OVERLAP: markers only in dispatcher lines and an unrelated targeted return prove nothing', () => {
  const dir = tempTree(OVERLAP, (rowDir) => outboundOnlyJournal(path.join(rowDir, 'journal/journal-filtered.log'), [SILENT, WAKING], [
    `Jul 04 15:21:40 cael node[1]: [continuation:delegate-spawned] hop=1/200 mode=silent session=agent:main:main task=${SILENT}`,
    `Jul 04 15:21:41 cael node[1]: [continuation:delegate-spawned] hop=1/200 mode=silent-wake session=agent:main:main task=${WAKING}`,
    'Jul 04 15:21:50 cael node[1]: [continuation:targeted-return] Delivered to agent:main:main from agent:main:subagent:continuation-unrelated',
  ]));
  const evidence = run(dir, 'r-cd-return-overlap.js', 'r-cd-return-overlap.json');
  assert.notEqual(evidence.both_targeted_returns_in_journal, true, 'outbound marker copies must not bind a return');
  assert.notEqual(evidence.verdict, 'PASS-candidate');
});

test('R-CD-COLLECTION-ON-COLLAPSE: the committed journal binds C\'s own return to the root', () => {
  const evidence = run(tempTree(COLLECTION), 'static-corpus-row-validator.js', 'r-cd-collection-on-collapse.json');
  assert.equal(evidence.checks?.cSentinelPresent ?? evidence.cSentinelPresent, true);
  assert.equal(evidence.checks?.rootCollection ?? evidence.rootCollection, true);
  assert.notEqual(evidence.verdict, 'FAIL-candidate');
});

test('R-CD-COLLECTION-ON-COLLAPSE: the dispatcher\'s C_SENTINEL_SCHEDULED= line and the root receipt\'s task copies prove no collection', () => {
  const dir = tempTree(COLLECTION, (rowDir) => {
    for (const name of ['journal/filtered.log', 'journal/load-bearing-lines.log']) {
      const file = path.join(rowDir, name);
      outboundOnlyJournal(file, [C_SENTINEL], []);
      writeFileSync(file, readFileSync(file, 'utf8').split('\n').filter((line) => !line.includes('[continuation:targeted-return]')).join('\n'));
    }
  });
  const evidence = run(dir, 'static-corpus-row-validator.js', 'r-cd-collection-on-collapse.json');
  const checks = evidence.checks || evidence;
  assert.notEqual(checks.rootCollection, true, 'the root receipt quoting the task is not a collection');
  assert.notEqual(evidence.verdict, 'PASS-candidate');
});
