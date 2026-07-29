#!/usr/bin/env node
/**
 * apply-project86-plan-corrections.mjs
 *
 * Deterministic, idempotent, fail-closed applier of the reviewed Project 86
 * fold-readiness mechanical corrections MC-01 .. MC-16 to the
 * `frond-scribe.project86.issue-plan.v1` issue plan.
 *
 * MC-17 (`<FINAL_CANDIDATE_SHA>` global substitution) is DELIBERATELY NOT
 * APPLIED. The final assembly candidate is not frozen. This tool must never
 * substitute a candidate SHA and must never set `candidate_sha`.
 *
 * Correction payloads are read from the committed review report rather than
 * re-transcribed here, so "applied exactly as reviewed" is mechanically true.
 * Both inputs are SHA-256 pinned; any drift is a hard failure.
 *
 * Usage:
 *   node analysis/apply-project86-plan-corrections.mjs \
 *     --plan <input-plan.json> \
 *     [--report analysis/project86-fold-readiness.json] \
 *     [--out analysis/project86-proof-issue-plan.corrected.json] \
 *     [--stdout-summary]
 *
 * Exit 0 only when every anchor and every expected count matched exactly.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import process from 'node:process';

const PINS = {
  input_plan_sha256:
    'af607246e60ad23ecd691275463dd5691fb8a107877a84553d1b5f8488604220',
  report_sha256:
    'fe3a082c676d0c7f7c3ae49e8880ee8c2680c8caebffa81687542e444140fb76',
  plan_schema: 'frond-scribe.project86.issue-plan.v1',
  report_schema: 'frond-scribe.project86.fold-readiness.v1',
  docs_base: 'abe1f9f0749d849b01da4e5d354c205ecffac946',
  catalog: '366251db79004274f4213e1cb59908aa27ef6693',
  contract: 'bb4ad4367e67190cba3f0909d58c36c259bf6a3d',
  breadcrumbs: '14355117ec7efb111cb013826c441e62a29954ce',
  review_commit: '6b97d681de2e4f23e650d3c36ea18408fc95467f',
};

const EXPECTED = {
  rows: 38,
  corpus_rows: 35,
  support_rows: 3,
  support_ids: ['preflight', 'R-CW-5A', 'R-CW-6A'],
  gateway_serialized_needing_guard: 18,
  serialized_after_contract_override: 20,
  live_runner_rows: 23,
  honest_limit_permitted_rows: ['R-RC-2'],
  applied_corrections: [
    'MC-01', 'MC-02', 'MC-03', 'MC-04', 'MC-05', 'MC-06', 'MC-07', 'MC-08',
    'MC-09', 'MC-10', 'MC-11', 'MC-12', 'MC-13', 'MC-14', 'MC-15', 'MC-16',
  ],
  deferred_corrections: ['MC-17'],
};

const CANDIDATE_TOKEN = '<FINAL_CANDIDATE_SHA>';

/** MC-14 note: the two corpus-fold lines are dropped for non-corpus entries. */
const MC14_CORPUS_ONLY_LINES = [
  '- [ ] `node tools/k6-proofs/scripts/validate-corpus.mjs --sha <FINAL_CANDIDATE_SHA>` output pasted\n',
  '- [ ] Scribe folded the row; `validate-corpus.mjs --index` exit 0 pasted\n',
];

class FailClosed extends Error {}

const die = (msg) => {
  throw new FailClosed(msg);
};

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const countOf = (haystack, needle) => {
  if (needle === '') die('internal: empty needle');
  return haystack.split(needle).length - 1;
};

function parseArgs(argv) {
  const out = {
    plan: null,
    report: 'analysis/project86-fold-readiness.json',
    out: 'analysis/project86-proof-issue-plan.corrected.json',
    stdoutSummary: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--plan') out.plan = argv[++i];
    else if (a === '--report') out.report = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--stdout-summary') out.stdoutSummary = true;
    else die(`unknown argument: ${a}`);
  }
  if (!out.plan) die('--plan <path-to-v1-issue-plan.json> is required');
  return out;
}

function readPinned(path, expectedSha, label, allowUnpinned) {
  let raw;
  try {
    raw = readFileSync(path);
  } catch (err) {
    die(`${label}: cannot read ${path}: ${err.message}`);
  }
  const got = sha256(raw);
  if (!allowUnpinned && got !== expectedSha) {
    die(
      `${label}: SHA-256 pin mismatch for ${path}\n` +
        `  expected ${expectedSha}\n  actual   ${got}\n` +
        '  Refusing to transform an input that is not the reviewed one.'
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch (err) {
    die(`${label}: ${path} is not valid JSON: ${err.message}`);
  }
  return { raw, sha256: got, json: parsed };
}

/* ------------------------------------------------------------------ */
/* correction primitives                                               */
/* ------------------------------------------------------------------ */

function replaceExact(text, find, replace, ctx) {
  const n = countOf(text, find);
  if (n < 1) die(`${ctx}: anchor absent -> ${JSON.stringify(find.slice(0, 90))}`);
  return { text: text.split(find).join(replace), count: n };
}

function insertBeforeExact(text, anchor, insert, ctx) {
  const n = countOf(text, anchor);
  if (n !== 1) {
    die(`${ctx}: expected exactly 1 occurrence of ${JSON.stringify(anchor)}, found ${n}`);
  }
  return { text: text.replace(anchor, `${insert}\n${anchor}`), count: 1 };
}

function insertAfterExact(text, anchor, insert, ctx, expectedOccurrences) {
  const n = countOf(text, anchor);
  if (n !== expectedOccurrences) {
    die(`${ctx}: expected exactly ${expectedOccurrences} occurrence(s) of ${JSON.stringify(anchor)}, found ${n}`);
  }
  const idx = text.indexOf(anchor);
  return {
    text: text.slice(0, idx + anchor.length) + insert + text.slice(idx + anchor.length),
    count: 1,
  };
}

/** Insert `insert` immediately after the single line containing `anchor`. */
function appendAfterLine(text, anchor, insert, ctx) {
  const lines = text.split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    if (line.includes(anchor)) hits.push(i);
  });
  if (hits.length !== 1) {
    die(`${ctx}: expected exactly 1 line containing ${JSON.stringify(anchor)}, found ${hits.length}`);
  }
  const i = hits[0];
  const head = lines.slice(0, i + 1).join('\n');
  const tail = lines.slice(i + 1).join('\n');
  return { text: `${head}\n${insert}${tail}`, count: 1 };
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

function main() {
  const args = parseArgs(process.argv.slice(2));

  const planIn = readPinned(args.plan, PINS.input_plan_sha256, 'input plan', false);
  const reportIn = readPinned(args.report, PINS.report_sha256, 'review report', false);

  const plan = planIn.json;
  const report = reportIn.json;

  /* ---- input invariants (fail closed) ---- */
  if (plan.schema !== PINS.plan_schema) die(`input plan schema is ${plan.schema}, expected ${PINS.plan_schema}`);
  if (plan.candidate_sha !== null) die('input plan candidate_sha is not null; this tool refuses a frozen-candidate input');
  if (!Array.isArray(plan.rows) || plan.rows.length !== EXPECTED.rows) {
    die(`input plan must carry exactly ${EXPECTED.rows} rows, found ${Array.isArray(plan.rows) ? plan.rows.length : 'none'}`);
  }
  if (report.schema !== PINS.report_schema) die(`review report schema is ${report.schema}, expected ${PINS.report_schema}`);
  if (report.verdict !== 'READY_AFTER_MECHANICAL_FIXES') die(`review report verdict is ${report.verdict}; refusing`);
  if (!Array.isArray(report.mechanical_corrections) || report.mechanical_corrections.length !== 17) {
    die('review report must carry exactly 17 mechanical corrections MC-01..MC-17');
  }
  for (const [k, v] of Object.entries({
    docs_base: PINS.docs_base, catalog: PINS.catalog, contract: PINS.contract, breadcrumbs: PINS.breadcrumbs,
  })) {
    const got = report.inputs?.[k]?.sha ?? report.inputs?.[k]?.commit ?? report.inputs?.[k];
    const asStr = typeof got === 'string' ? got : JSON.stringify(got ?? null);
    if (!asStr.includes(v)) die(`review report input ${k} does not pin ${v} (got ${asStr.slice(0, 120)})`);
  }

  const rowIds = plan.rows.map((r) => r.row_id);
  if (new Set(rowIds).size !== EXPECTED.rows) die('duplicate row_id in input plan');
  const matrixIds = report.issue_matrix.map((m) => m.row_id);
  if (new Set(matrixIds).size !== EXPECTED.rows) die('duplicate row_id in review report issue_matrix');
  for (const id of matrixIds) if (!rowIds.includes(id)) die(`catalog row ${id} missing from input plan`);
  for (const id of rowIds) if (!matrixIds.includes(id)) die(`plan row ${id} absent from reviewed catalog matrix`);

  const corpusIds = report.issue_matrix.filter((m) => m.corpus_row === true).map((m) => m.row_id);
  const supportIds = report.issue_matrix.filter((m) => m.corpus_row !== true).map((m) => m.row_id);
  if (corpusIds.length !== EXPECTED.corpus_rows) die(`reviewed catalog must declare ${EXPECTED.corpus_rows} corpus rows, found ${corpusIds.length}`);
  if (supportIds.length !== EXPECTED.support_rows) die(`reviewed catalog must declare ${EXPECTED.support_rows} support entries, found ${supportIds.length}`);
  for (const id of EXPECTED.support_ids) if (!supportIds.includes(id)) die(`expected support entry ${id} is not marked non-corpus in the reviewed catalog`);

  const MC = new Map(report.mechanical_corrections.map((m) => [m.id, m]));
  for (const id of [...EXPECTED.applied_corrections, ...EXPECTED.deferred_corrections]) {
    if (!MC.has(id)) die(`review report is missing ${id}`);
  }

  /* ---- working copy ---- */
  const rows = new Map(
    plan.rows.map((r) => [
      r.row_id,
      {
        row_id: r.row_id,
        assignee: r.assignee,
        title: r.title,
        body: r.body,
        execution_class: r.execution_class,
        artifact_subtree: r.artifact_subtree,
        failure_scope: JSON.parse(JSON.stringify(r.failure_scope)),
      },
    ])
  );
  const order = rowIds.slice();

  const ledger = [];
  const record = (id, kind, sites, rowsTouched, notes) =>
    ledger.push({ id, kind, sites, rows_touched: rowsTouched, notes: notes ?? null });

  const requireAppliesTo = (mc, expectedLen) => {
    if (!Array.isArray(mc.applies_to) || mc.applies_to.length !== expectedLen) {
      die(`${mc.id}: expected applies_to length ${expectedLen}, found ${mc.applies_to?.length}`);
    }
    for (const rid of mc.applies_to) if (!rows.has(rid)) die(`${mc.id}: applies_to names unknown row ${rid}`);
  };

  /* ---------------- MC-01 : drop the pre-attested runtime build SHA ------- */
  {
    const mc = MC.get('MC-01');
    if (mc.kind !== 'replace_in_body') die('MC-01 kind drifted');
    requireAppliesTo(mc, EXPECTED.live_runner_rows);
    let sites = 0;
    for (const rid of mc.applies_to) {
      const row = rows.get(rid);
      const r = replaceExact(row.body, mc.find, mc.replace, `MC-01/${rid}`);
      row.body = r.text;
      sites += r.count;
    }
    if (sites !== EXPECTED.live_runner_rows) die(`MC-01: expected ${EXPECTED.live_runner_rows} sites, applied ${sites}`);
    record('MC-01', mc.kind, sites, mc.applies_to.length);
  }

  /* ---------------- MC-02 : mechanical disposable session ---------------- */
  {
    const mc = MC.get('MC-02');
    if (mc.kind !== 'replace_in_body') die('MC-02 kind drifted');
    requireAppliesTo(mc, EXPECTED.live_runner_rows);
    let sites = 0;
    for (const rid of mc.applies_to) {
      const row = rows.get(rid);
      const r = replaceExact(row.body, mc.find, mc.replace, `MC-02/${rid}`);
      row.body = r.text;
      sites += r.count;
    }
    if (sites !== EXPECTED.live_runner_rows) die(`MC-02: expected ${EXPECTED.live_runner_rows} sites, applied ${sites}`);
    record('MC-02', mc.kind, sites, mc.applies_to.length);
  }

  /* ---------------- MC-03 : fail-closed same-session guard ---------------- */
  /* MUST run before MC-04, which introduces a second ```bash fence.          */
  {
    const mc = MC.get('MC-03');
    if (mc.kind !== 'insert_in_command_fence') die('MC-03 kind drifted');
    requireAppliesTo(mc, EXPECTED.gateway_serialized_needing_guard);
    const guarded = new Set(report.assignment.serialized_rows_contract_corrected ?? []);
    for (const rid of mc.applies_to) {
      if (!guarded.has(rid)) die(`MC-03: ${rid} is not in the reviewed serialized set`);
    }
    let sites = 0;
    for (const rid of mc.applies_to) {
      const row = rows.get(rid);
      if (countOf(row.body, '```bash') !== 1) die(`MC-03/${rid}: body must hold exactly one bash fence at this stage`);
      const r = insertAfterExact(row.body, mc.insert_after, mc.text, `MC-03/${rid}`, 1);
      row.body = r.text;
      sites += r.count;
    }
    if (sites !== EXPECTED.gateway_serialized_needing_guard) die(`MC-03: expected ${EXPECTED.gateway_serialized_needing_guard} sites, applied ${sites}`);
    record('MC-03', mc.kind, sites, mc.applies_to.length, 'applied before MC-04 so the single pre-existing bash fence is unambiguous');
  }

  /* ---------------- MC-04 : G1-G5 pre-fire identity gate ------------------ */
  {
    const mc = MC.get('MC-04');
    if (mc.kind !== 'insert_section') die('MC-04 kind drifted');
    requireAppliesTo(mc, EXPECTED.rows);
    let sites = 0;
    for (const rid of mc.applies_to) {
      const row = rows.get(rid);
      const r = insertBeforeExact(row.body, mc.insert_before, mc.text, `MC-04/${rid}`);
      row.body = r.text;
      sites += r.count;
    }
    if (sites !== EXPECTED.rows) die(`MC-04: expected ${EXPECTED.rows} sites, applied ${sites}`);
    record('MC-04', mc.kind, sites, mc.applies_to.length);
  }

  /* ---------------- MC-05 : retarget support artifact subtrees ------------ */
  {
    const mc = MC.get('MC-05');
    if (mc.kind !== 'replace_in_body') die('MC-05 kind drifted');
    requireAppliesTo(mc, EXPECTED.support_rows);
    let bodySites = 0;
    let subtreeSites = 0;
    for (const rid of mc.applies_to) {
      if (!EXPECTED.support_ids.includes(rid)) die(`MC-05: ${rid} is not a reviewed non-corpus support entry`);
      const spec = mc.per_row?.[rid];
      if (!spec) die(`MC-05: no per_row spec for ${rid}`);
      const row = rows.get(rid);
      const b = replaceExact(row.body, spec.find, spec.replace, `MC-05/body/${rid}`);
      row.body = b.text;
      bodySites += b.count;
      const s = replaceExact(row.artifact_subtree, spec.find, spec.replace, `MC-05/artifact_subtree/${rid}`);
      row.artifact_subtree = s.text;
      subtreeSites += s.count;
      if (/\/PROOFS\/|^PROOFS\//.test(row.artifact_subtree) === false) die(`MC-05/${rid}: retargeted subtree lost its PROOFS root`);
    }
    if (bodySites !== EXPECTED.support_rows || subtreeSites !== EXPECTED.support_rows) {
      die(`MC-05: expected ${EXPECTED.support_rows} body + ${EXPECTED.support_rows} subtree sites, applied ${bodySites} + ${subtreeSites}`);
    }
    record('MC-05', mc.kind, bodySites + subtreeSites, mc.applies_to.length,
      `${bodySites} body sites + ${subtreeSites} rows[].artifact_subtree sites; the subtree field is retargeted too because report check C08 is about that field`);
  }

  /* ---------------- MC-06 : declare non-corpus status --------------------- */
  {
    const mc = MC.get('MC-06');
    if (mc.kind !== 'append_after_line') die('MC-06 kind drifted');
    requireAppliesTo(mc, EXPECTED.support_rows);
    let sites = 0;
    for (const rid of mc.applies_to) {
      const row = rows.get(rid);
      const r = appendAfterLine(row.body, mc.anchor, mc.text, `MC-06/${rid}`);
      row.body = r.text;
      sites += r.count;
    }
    if (sites !== EXPECTED.support_rows) die(`MC-06: expected ${EXPECTED.support_rows} sites, applied ${sites}`);
    record('MC-06', mc.kind, sites, mc.applies_to.length);
  }

  /* ---------------- MC-07 : R-RC-2 serialized + ordered ------------------- */
  {
    const mc = MC.get('MC-07');
    if (mc.kind !== 'replace_in_body') die('MC-07 kind drifted');
    requireAppliesTo(mc, 1);
    let sites = 0;
    for (const rid of mc.applies_to) {
      const spec = mc.per_row?.[rid];
      if (!spec) die(`MC-07: no per_row spec for ${rid}`);
      const row = rows.get(rid);
      const r = replaceExact(row.body, spec.find, spec.replace, `MC-07/${rid}`);
      row.body = r.text;
      sites += r.count;
    }
    if (sites !== 1) die(`MC-07: expected 1 site, applied ${sites}`);
    record('MC-07', mc.kind, sites, mc.applies_to.length);
  }

  /* ---------------- MC-08 : R-RC-1 family ordering ------------------------ */
  {
    const mc = MC.get('MC-08');
    if (mc.kind !== 'append_after_line') die('MC-08 kind drifted');
    requireAppliesTo(mc, 1);
    let sites = 0;
    for (const rid of mc.applies_to) {
      const row = rows.get(rid);
      const r = appendAfterLine(row.body, mc.anchor, mc.text, `MC-08/${rid}`);
      row.body = r.text;
      sites += r.count;
    }
    if (sites !== 1) die(`MC-08: expected 1 site, applied ${sites}`);
    record('MC-08', mc.kind, sites, mc.applies_to.length);
  }

  /* ---------------- MC-09 : R-CW-5 / R-CW-6 fixture serialization --------- */
  {
    const mc = MC.get('MC-09');
    if (mc.kind !== 'replace_in_body') die('MC-09 kind drifted');
    requireAppliesTo(mc, 2);
    let sites = 0;
    for (const rid of mc.applies_to) {
      const row = rows.get(rid);
      if (row.execution_class !== 'isolated fixture') die(`MC-09/${rid}: expected an isolated fixture row, found ${row.execution_class}`);
      const r = replaceExact(row.body, mc.find, mc.replace, `MC-09/${rid}`);
      row.body = r.text;
      sites += r.count;
    }
    if (sites !== 2) die(`MC-09: expected 2 sites, applied ${sites}`);
    record('MC-09', mc.kind, sites, mc.applies_to.length, 'scoped strictly by applies_to; the find string is shared with 17 gateway rows that must keep the session-lock wording');
  }

  /* ---------------- MC-10 : one accountable prince ------------------------ */
  const rebalance = [];
  {
    const mc = MC.get('MC-10');
    if (mc.kind !== 'replace_in_body') die('MC-10 kind drifted');
    requireAppliesTo(mc, EXPECTED.rows);
    let sites = 0;
    for (const rid of mc.applies_to) {
      const spec = mc.per_row?.[rid];
      if (!spec) die(`MC-10: no per_row spec for ${rid}`);
      const row = rows.get(rid);
      const r = replaceExact(row.body, spec.find, spec.replace, `MC-10/${rid}`);
      row.body = r.text;
      sites += r.count;

      const m = /Accountable prince: `@([A-Za-z0-9._-]+)`/.exec(spec.replace);
      if (!m) die(`MC-10/${rid}: replacement does not name exactly one accountable prince`);
      if (countOf(spec.replace, 'Accountable prince:') !== 1) die(`MC-10/${rid}: more than one accountable prince named`);
      if (!spec.replace.includes('A substitution is valid only when the canonical seat is unavailable')) {
        die(`MC-10/${rid}: reviewed substitution note absent`);
      }
      const prince = m[1];
      const planned = row.assignee;
      if (prince !== planned) rebalance.push({ row_id: rid, from: planned, to: prince });
      row.assignee = prince;
    }
    if (sites !== EXPECTED.rows) die(`MC-10: expected ${EXPECTED.rows} sites, applied ${sites}`);

    const reviewed = report.assignment?.rebalance_moves ?? [];
    const key = (m) => `${m.row_id}|${m.from}|${m.to}`;
    const got = new Set(rebalance.map(key));
    const want = new Set(reviewed.map(key));
    if (got.size !== want.size) die(`MC-10: derived ${got.size} rebalance moves, reviewed report declares ${want.size}`);
    for (const k of want) if (!got.has(k)) die(`MC-10: reviewed rebalance move not reproduced: ${k}`);
    for (const k of got) if (!want.has(k)) die(`MC-10: unreviewed rebalance move produced: ${k}`);
    record('MC-10', mc.kind, sites, mc.applies_to.length,
      `also synchronised rows[].assignee with the named accountable prince; ${rebalance.length} rebalance moves, set-identical to the reviewed report`);
  }

  /* ---------------- MC-11 : both-forms mandate + sibling ------------------ */
  {
    const mc = MC.get('MC-11');
    if (mc.kind !== 'append_after_line') die('MC-11 kind drifted');
    requireAppliesTo(mc, EXPECTED.rows);
    let sites = 0;
    for (const rid of mc.applies_to) {
      const spec = mc.per_row?.[rid];
      if (!spec || typeof spec.text !== 'string') die(`MC-11: no per_row text for ${rid}`);
      if (!spec.text.includes('**Both-forms mandate:**')) die(`MC-11/${rid}: per_row text lacks the both-forms mandate`);
      const row = rows.get(rid);
      const r = appendAfterLine(row.body, mc.anchor, spec.text, `MC-11/${rid}`);
      row.body = r.text;
      sites += r.count;
    }
    if (sites !== EXPECTED.rows) die(`MC-11: expected ${EXPECTED.rows} sites, applied ${sites}`);
    record('MC-11', mc.kind, sites, mc.applies_to.length);
  }

  /* ---------------- MC-12 : governing documents --------------------------- */
  {
    const mc = MC.get('MC-12');
    if (mc.kind !== 'insert_section') die('MC-12 kind drifted');
    requireAppliesTo(mc, EXPECTED.rows);
    for (const pin of [PINS.contract, PINS.catalog, PINS.breadcrumbs]) {
      if (!mc.text.includes(pin)) die(`MC-12: reviewed text does not pin ${pin}`);
    }
    let sites = 0;
    for (const rid of mc.applies_to) {
      const row = rows.get(rid);
      const r = insertBeforeExact(row.body, mc.insert_before, mc.text, `MC-12/${rid}`);
      row.body = r.text;
      sites += r.count;
    }
    if (sites !== EXPECTED.rows) die(`MC-12: expected ${EXPECTED.rows} sites, applied ${sites}`);
    record('MC-12', mc.kind, sites, mc.applies_to.length);
  }

  /* ---------------- MC-13 : contract-template titles ---------------------- */
  {
    const mc = MC.get('MC-13');
    if (mc.kind !== 'replace_title') die('MC-13 kind drifted');
    requireAppliesTo(mc, EXPECTED.rows);
    let sites = 0;
    for (const rid of mc.applies_to) {
      const spec = mc.per_row?.[rid];
      if (!spec) die(`MC-13: no per_row spec for ${rid}`);
      const row = rows.get(rid);
      if (row.title !== spec.find) {
        die(`MC-13/${rid}: title drifted\n  expected ${JSON.stringify(spec.find)}\n  actual   ${JSON.stringify(row.title)}`);
      }
      if (!spec.replace.startsWith(`[P86] ${rid} `)) die(`MC-13/${rid}: replacement title does not follow the template prefix`);
      if (spec.replace.includes(CANDIDATE_TOKEN)) die(`MC-13/${rid}: replacement title must not carry the candidate token`);
      row.title = spec.replace;
      sites += 1;
    }
    if (sites !== EXPECTED.rows) die(`MC-13: expected ${EXPECTED.rows} sites, applied ${sites}`);
    record('MC-13', mc.kind, sites, mc.applies_to.length);
  }

  /* ---------------- MC-14 : wave, reviewer, completion checklist ---------- */
  {
    const mc = MC.get('MC-14');
    if (mc.kind !== 'append_section') die('MC-14 kind drifted');
    requireAppliesTo(mc, EXPECTED.rows);
    for (const line of MC14_CORPUS_ONLY_LINES) {
      if (countOf(mc.text, line) !== 1) die('MC-14: a corpus-only checklist line named by the reviewed note is absent from the reviewed text');
    }
    const fullItems = countOf(mc.text, '- [ ] ');
    let sites = 0;
    let normalised = 0;
    let trimmedSupport = 0;
    for (const rid of mc.applies_to) {
      const row = rows.get(rid);
      const isSupport = EXPECTED.support_ids.includes(rid);
      let text = mc.text;
      if (isSupport) {
        for (const line of MC14_CORPUS_ONLY_LINES) text = text.split(line).join('');
        if (countOf(text, '- [ ] ') !== fullItems - MC14_CORPUS_ONLY_LINES.length) die(`MC-14/${rid}: support-entry checklist trim produced the wrong item count`);
        trimmedSupport += 1;
      }
      if (!row.body.endsWith('\n')) {
        row.body += '\n';
        normalised += 1;
      }
      row.body += text;
      sites += 1;
    }
    if (sites !== EXPECTED.rows) die(`MC-14: expected ${EXPECTED.rows} sites, applied ${sites}`);
    if (trimmedSupport !== EXPECTED.support_rows) die(`MC-14: expected ${EXPECTED.support_rows} trimmed support entries, trimmed ${trimmedSupport}`);
    record('MC-14', mc.kind, sites, mc.applies_to.length,
      `${fullItems}-item checklist on ${EXPECTED.corpus_rows} corpus rows, ${fullItems - MC14_CORPUS_ONLY_LINES.length}-item on ${EXPECTED.support_rows} support entries per the reviewed note; ${normalised} bodies given a single trailing newline first so the appended section starts on its own line`);
  }

  /* ---------------- MC-15 : R-OBS-1 repeat-failure guard ------------------ */
  {
    const mc = MC.get('MC-15');
    if (mc.kind !== 'append_after_line') die('MC-15 kind drifted');
    requireAppliesTo(mc, 1);
    let sites = 0;
    for (const rid of mc.applies_to) {
      const row = rows.get(rid);
      const r = appendAfterLine(row.body, mc.anchor, mc.text, `MC-15/${rid}`);
      row.body = r.text;
      sites += r.count;
    }
    if (sites !== 1) die(`MC-15: expected 1 site, applied ${sites}`);
    record('MC-15', mc.kind, sites, mc.applies_to.length);
  }

  /* ---------------- MC-16 : R-CD-3 dedicated disposable session ----------- */
  {
    const mc = MC.get('MC-16');
    if (mc.kind !== 'replace_in_body') die('MC-16 kind drifted');
    requireAppliesTo(mc, 1);
    let sites = 0;
    for (const rid of mc.applies_to) {
      const spec = mc.per_row?.[rid];
      if (!spec) die(`MC-16: no per_row spec for ${rid}`);
      const row = rows.get(rid);
      const r = replaceExact(row.body, spec.find, spec.replace, `MC-16/${rid}`);
      row.body = r.text;
      sites += r.count;
    }
    if (sites !== 1) die(`MC-16: expected 1 site, applied ${sites}`);
    record('MC-16', mc.kind, sites, mc.applies_to.length);
  }

  /* ---------------- MC-17 : DEFERRED, never applied here ------------------ */
  {
    const mc = MC.get('MC-17');
    if (mc.kind !== 'global_substitution') die('MC-17 kind drifted');
    record('MC-17', mc.kind, 0, 0, 'DEFERRED: final assembly candidate is not frozen; candidate_sha stays null and <FINAL_CANDIDATE_SHA> stays literal');
  }

  /* ---------------- post-conditions (fail closed) ------------------------- */
  const outRows = order.map((rid) => rows.get(rid));

  const assertAll = (pred, msg) => {
    const bad = outRows.filter((r) => !pred(r)).map((r) => r.row_id);
    if (bad.length) die(`${msg} -> offending rows: ${bad.join(', ')}`);
  };

  assertAll((r) => !r.body.includes('OPENCLAW_RUNTIME_BUILD_SHA='), 'MC-01 post-condition: a body still pre-attests OPENCLAW_RUNTIME_BUILD_SHA=');
  assertAll((r) => !r.body.includes('Live assignment: none'), 'MC-10 post-condition: a body still says "Live assignment: none"');
  assertAll((r) => countOf(r.body, 'Accountable prince:') === 1, 'MC-10 post-condition: a body does not name exactly one accountable prince');
  assertAll((r) => r.body.includes(`Accountable prince: \`@${r.assignee}\``), 'MC-10 post-condition: rows[].assignee disagrees with the body prince');
  assertAll((r) => r.body.includes('A substitution is valid only when the canonical seat is unavailable'), 'MC-10 post-condition: reviewed substitution note missing');
  assertAll((r) => r.body.includes('OPENCLAW_CREATE_DISPOSABLE_SESSION=true') || !r.body.includes('./scripts/run-proofs.sh --live '), 'MC-02 post-condition: a live-runner body lacks the disposable-session variables');
  assertAll((r) => r.body.includes('G1 ok') && r.body.includes('seat-readiness-preflight.mjs'), 'MC-04 post-condition: a body lacks the G1-G5 pre-fire identity gate');
  assertAll((r) => r.body.includes('**Both-forms mandate:**'), 'MC-11 post-condition: a body lacks the both-forms mandate');
  assertAll((r) => r.body.includes('project86-proof-code-breadcrumbs') && r.body.includes('project86-regression-triage-template') && r.body.includes('project86-proof-round-contract'), 'MC-12 post-condition: a body lacks contract/breadcrumbs/triage references');
  assertAll((r) => r.title.startsWith('[P86] '), 'MC-13 post-condition: a title is not in template form');
  assertAll((r) => r.body.includes('## Wave') && r.body.includes('## Completion checklist'), 'MC-14 post-condition: a body lacks wave/completion checklist');
  assertAll((r) => r.body.includes('Continue independent proof rows unless the finding is explicitly classified as a halt-state.'), 'fleet-halt post-condition: a body lost the continue-independent clause');
  assertAll((r) => r.failure_scope && r.failure_scope.blocks_all_proofs === false, 'fleet-halt post-condition: a row declares blocks_all_proofs true');

  const guardRows = MC.get('MC-03').applies_to;
  for (const rid of guardRows) {
    const row = rows.get(rid);
    if (!row.body.includes('live-run-guard.mjs')) die(`MC-03 post-condition: gateway-serialized row ${rid} lacks live-run-guard.mjs`);
    if (!row.body.includes('That output is a coordination')) die(`MC-03 post-condition: gateway-serialized row ${rid} lacks the fail-closed STOP clause`);
  }
  const guardCount = outRows.filter((r) => r.body.includes('live-run-guard.mjs')).length;
  if (guardCount !== EXPECTED.gateway_serialized_needing_guard) {
    die(`MC-03 post-condition: exactly ${EXPECTED.gateway_serialized_needing_guard} gateway-serialized bodies must reference live-run-guard.mjs, found ${guardCount}`);
  }
  for (const rid of ['R-CW-5', 'R-CW-6']) {
    if (rows.get(rid).body.includes('live-run-guard.mjs')) {
      die(`MC-09 post-condition: fixture row ${rid} must not claim gateway-session lock enforcement`);
    }
  }

  const rrc2 = rows.get('R-RC-2');
  if (rrc2.body.includes('Same-session concurrency safe: **true**')) die('MC-07 post-condition: R-RC-2 still claims same-session concurrency safety');
  if (!rrc2.body.includes('false (contract override, fail-closed)')) die('MC-07 post-condition: R-RC-2 lacks the explicit procedural override');
  if (!rrc2.body.includes('`R-RC-1` must execute and resolve before R-RC-2')) die('MC-07 post-condition: R-RC-2 lacks the fixed ordering');
  if (!rows.get('R-RC-1').body.includes('R-RC-2 may not be attempted on a session until this row has executed and resolved')) {
    die('MC-08 post-condition: R-RC-1 lacks the family ordering obligation');
  }

  for (const rid of ['R-CW-5', 'R-CW-6']) {
    const row = rows.get(rid);
    if (!row.body.includes('opens no gateway session and takes no same-session lock')) die(`MC-09 post-condition: ${rid} still claims a gateway-session lock`);
    if (!row.body.includes('Serialize on the **fixture resources**')) die(`MC-09 post-condition: ${rid} lacks fixture-resource serialization`);
    if (row.body.includes('Serialize this row under the runner lock and do not overlap another continuation row on the same target session.')) {
      die(`MC-09 post-condition: ${rid} retains the unactionable runner-lock sentence`);
    }
  }

  for (const rid of EXPECTED.support_ids) {
    const row = rows.get(rid);
    if (!row.body.includes('**Not a corpus row.**')) die(`MC-06 post-condition: ${rid} lacks the non-corpus declaration`);
    if (!row.body.includes('NOT a member of the 35-row exact-SHA denominator')) die(`MC-06 post-condition: ${rid} does not state it is outside the 35-row rollup`);
    const ok = row.artifact_subtree.includes('/_static-companions/') || row.artifact_subtree.includes('/gates/preflight/');
    if (!ok) die(`MC-05 post-condition: ${rid} artifact_subtree ${row.artifact_subtree} is not a reviewed non-corpus support location`);
    if (new RegExp(`PROOFS/${CANDIDATE_TOKEN.replace(/[<>]/g, (c) => `\\${c}`)}/${rid}/`).test(row.artifact_subtree)) {
      die(`MC-05 post-condition: ${rid} still occupies a bare corpus row dir`);
    }
  }
  for (const rid of corpusIds) {
    const row = rows.get(rid);
    if (row.artifact_subtree.includes('_static-companions') || row.artifact_subtree.includes('gates/preflight')) {
      die(`MC-05 post-condition: corpus row ${rid} was wrongly retargeted to a support location`);
    }
  }

  const hlPermitted = outRows.filter((r) => !/- \*\*HONEST_LIMIT:\*\* Not permitted/.test(r.body)).map((r) => r.row_id);
  if (hlPermitted.length !== EXPECTED.honest_limit_permitted_rows.length || hlPermitted.some((x, i) => x !== EXPECTED.honest_limit_permitted_rows[i])) {
    die(`HONEST_LIMIT post-condition: permitted on ${JSON.stringify(hlPermitted)}, expected ${JSON.stringify(EXPECTED.honest_limit_permitted_rows)}`);
  }

  /* candidate freeze must NOT have happened */
  const sha40 = /\b[0-9a-f]{40}\b/g;
  const allowedShas = new Set([PINS.docs_base, PINS.catalog, PINS.contract, PINS.breadcrumbs,
    '4c235d8c1997e8964160117f8d6bf650ad1e8203', 'b134a64a44351bcbce2d086da4ac30a596c01699']);
  let candidateTokenSites = 0;
  for (const r of outRows) {
    candidateTokenSites += countOf(r.body, CANDIDATE_TOKEN) + countOf(r.artifact_subtree, CANDIDATE_TOKEN) + countOf(r.title, CANDIDATE_TOKEN);
    for (const field of [r.body, r.title, r.artifact_subtree]) {
      for (const m of field.match(sha40) ?? []) {
        if (!allowedShas.has(m)) die(`candidate-freeze post-condition: row ${r.row_id} carries an unreviewed 40-hex SHA (${m.slice(0, 8)}...); MC-17 must not be applied here`);
      }
    }
  }
  if (candidateTokenSites < 1) die('candidate-freeze post-condition: <FINAL_CANDIDATE_SHA> was eliminated; MC-17 must remain deferred');

  /* secret-shape scan: only bare env var names and *** placeholders permitted */
  const secretPatterns = [
    [/https:\/\/(discord|hooks\.slack)\.[^\s`'")]+/i, 'webhook URL'],
    [/gh[pousr]_[A-Za-z0-9]{16,}/, 'GitHub token'],
    [/xox[abps]-[A-Za-z0-9-]{10,}/, 'Slack token'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
    [/OPENCLAW_GATEWAY_TOKEN\s*=\s*(?!\s*$)[^\s\\`]+/, 'gateway token value'],
    [/OPENCLAW_SESSION_KEY\s*=\s*(?!<SESSION_KEY>|"\$)[^\s\\`]+/, 'session key value'],
    [/WEBHOOK_[A-Z_]*\s*=\s*[^\s\\`]+/, 'webhook secret value'],
  ];
  for (const r of outRows) {
    for (const field of ['title', 'body', 'artifact_subtree']) {
      for (const [re, label] of secretPatterns) {
        if (re.test(r[field])) die(`secret-scan post-condition: row ${r.row_id} field ${field} matches ${label}`);
      }
    }
  }

  /* ---------------- emit ------------------------------------------------- */
  const out = {
    schema: plan.schema,
    umbrella_issue: plan.umbrella_issue,
    project: plan.project,
    candidate_sha: null,
    corrections: {
      source_review_commit: PINS.review_commit,
      source_review_report: 'analysis/project86-fold-readiness.json',
      source_review_verdict: report.verdict,
      input_plan_sha256: planIn.sha256,
      review_report_sha256: reportIn.sha256,
      reviewed_inputs: {
        docs_base: PINS.docs_base,
        catalog: PINS.catalog,
        contract: PINS.contract,
        breadcrumbs: PINS.breadcrumbs,
      },
      applied: EXPECTED.applied_corrections,
      deferred: {
        'MC-17': {
          status: 'DEFERRED',
          reason: 'The final assembly candidate is not frozen. candidate_sha remains null and every <FINAL_CANDIDATE_SHA> site remains a literal placeholder, to be resolved in one atomic substitution once the candidate is bound.',
          candidate_token: CANDIDATE_TOKEN,
          remaining_substitution_sites: {
            body: outRows.reduce((a, r) => a + countOf(r.body, CANDIDATE_TOKEN), 0),
            title: outRows.reduce((a, r) => a + countOf(r.title, CANDIDATE_TOKEN), 0),
            artifact_subtree: outRows.reduce((a, r) => a + countOf(r.artifact_subtree, CANDIDATE_TOKEN), 0),
            total: candidateTokenSites,
          },
          reviewed_precorrection_sites: MC.get('MC-17').counts,
          note: 'The review report counted 348 sites against the uncorrected plan. MC-04, MC-05, MC-06 and MC-14 add further sites, so the post-correction total above supersedes 348 as the MC-17 assertion target.',
        },
      },
      ledger,
      rebalance_moves: rebalance,
      denominator: {
        dispatched_issues: EXPECTED.rows,
        corpus_rows: EXPECTED.corpus_rows,
        support_entries: EXPECTED.support_ids,
        statement: report.final_recommendation.denominator_language,
      },
      unresolved_placeholders: ['<FINAL_CANDIDATE_SHA>', '<SEAT>', '<SESSION_KEY>', '<PRINCE>', '<ROW-ID>', '<row>', '<FEATURE_SOURCE_PATH>', '<FEATURE_MARKER>', '<EXACT_CANDIDATE_WORKTREE>', '<EMPTY_PRIVATE_ARTIFACT_DIR>'],
    },
    rows: outRows,
  };

  const serialised = `${JSON.stringify(out, null, 2)}\n`;
  writeFileSync(args.out, serialised);

  if (args.stdoutSummary) {
    process.stdout.write(`${JSON.stringify({
      input_plan_sha256: planIn.sha256,
      review_report_sha256: reportIn.sha256,
      output_path: args.out,
      output_sha256: sha256(Buffer.from(serialised)),
      rows: outRows.length,
      corpus_rows: EXPECTED.corpus_rows,
      support_entries: EXPECTED.support_ids,
      candidate_sha: out.candidate_sha,
      applied: EXPECTED.applied_corrections,
      deferred: EXPECTED.deferred_corrections,
      ledger,
      rebalance_moves: rebalance,
      candidate_token_sites_remaining: candidateTokenSites,
    }, null, 2)}\n`);
  } else {
    process.stderr.write(`wrote ${args.out} (${outRows.length} rows, candidate_sha=null, MC-17 deferred)\n`);
  }
}

try {
  main();
} catch (err) {
  if (err instanceof FailClosed) {
    process.stderr.write(`FAIL-CLOSED: ${err.message}\n`);
    process.exit(2);
  }
  throw err;
}
