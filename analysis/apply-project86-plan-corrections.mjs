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

const REPO_ROOT = new URL('../', import.meta.url);

const PINS = {
  input_plan_sha256:
    'af607246e60ad23ecd691275463dd5691fb8a107877a84553d1b5f8488604220',
  report_sha256:
    'fe3a082c676d0c7f7c3ae49e8880ee8c2680c8caebffa81687542e444140fb76',
  /**
   * The exact corrected output. Feeding these bytes back in as `--plan` is a
   * validated no-op that re-emits them byte-identically (see `runNoOp`), so the
   * transformer is genuinely idempotent rather than merely deterministic.
   */
  corrected_plan_sha256:
    'b3b3a7e88772dd792d26b3beffa7d74f0c9f16d0a302ee6f13bf2bb03d446885',
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
  /** 18 lock preambles + 18 `flock` wrappers around the primary run command. */
  gateway_serialized_lock_sites: 36,
  serialized_after_contract_override: 20,
  live_runner_rows: 23,
  honest_limit_permitted_rows: ['R-RC-2'],
  applied_corrections: [
    'MC-01', 'MC-02', 'MC-03', 'MC-04', 'MC-05', 'MC-06', 'MC-07', 'MC-08',
    'MC-09', 'MC-10', 'MC-11', 'MC-12', 'MC-13', 'MC-14', 'MC-15', 'MC-16',
  ],
  deferred_corrections: ['MC-17'],
  superseded_corrections: ['MC-03', 'MC-11/R-OBS-1'],
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
const sha256Text = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/* ------------------------------------------------------------------ */
/* supersessions                                                       */
/* ------------------------------------------------------------------ */

/**
 * The reviewed report at 6b97d681 stays byte-frozen. Two of its payloads were
 * found defective by the independent review of PR #452, so they are superseded
 * here instead of being rewritten in the reviewed artifact. Each supersession
 * pins the SHA-256 of the exact reviewed bytes it replaces, so the defect is
 * still provable and any drift in the reviewed report fails closed.
 */
const SUPERSEDED = {
  'MC-03': {
    reviewed_text_sha256:
      '411c79a7226afc1d00f67fcc5eaf7a2e1b3a1cd327cf732105c0c9f9fcbd903d',
    finding:
      'PR #452 independent review, HIGH: the reviewed payload invoked live-run-guard.mjs --json, which only computes and prints lock metadata. It acquired no lock, created no lock file, and was not chained to the run, so all 18 rows claimed serialized could overlap.',
    resolution:
      'The primary path now resolves the lock from the row\'s own manifest and holds it, via flock, for the entire run-proofs.sh execution. Every step is && -chained, so a guard refusal or a held lock stops the row before k6 starts.',
    canonical_wrapper_note:
      'tools/k6-proofs/run-proof.sh is the existing flock owner but takes a scenario name only: it cannot carry the row+candidate contract or emit the run-result/runner-metadata/evidence artifact set these rows require. An explicit flock wrapper with equivalent ownership is used instead.',
  },
  'MC-11/R-OBS-1': {
    reviewed_text_sha256:
      'fd829ed2b588fe0572198e0defb3289bedaf07d0f87b8d176b759f41b4a032c2',
    finding:
      'PR #452 independent review, MEDIUM: the reviewed payload declared the both-forms mandate required for R-OBS-1, named the token-form sibling `None`, and then declared a single-surface row INCOMPLETE. The completion contract was unsatisfiable.',
    resolution:
      'R-OBS-1 is a read-only session_status observability row (manifest tools/k6-proofs/manifests/r-obs-1.json: mutates=false, fires no continuation tool, delegate, restart or compaction). The status card has no bracket-token surface, so the both-forms mandate is marked not applicable, consistent with R-OBS-2 and R-OBS-STATUS.',
    text:
      '\n**Both-forms mandate:** not applicable\n' +
      '- read-only `session_status` observability row; the status card has no bracket-token surface and this row fires no continuation primitive\n' +
      '\n**Surface provenance:** a continuation token inside a `message` tool body is **not** token proof. Record which surface carried the token (raw assistant final text vs message-tool body) in `EVIDENCE.md`.\n',
  },
};

/** Lock preamble inserted at the head of the primary command fence. */
/**
 * The one sentence of the superseded MC-03 payload that is still true and still
 * binding. Supersession replaces the mechanism, not the reviewed obligation, so
 * this clause is carried verbatim and asserted as a post-condition.
 */
const REVIEWED_STOP_CLAUSE =
  'If the guard reports an active same-session lock: STOP. That output is a coordination';

const lockPreamble = (manifestPath) =>
  '# Fail-closed same-session serialization. This row is NOT same-session concurrency\n' +
  '# safe, so the real lock must be HELD for the whole run, not merely reported.\n' +
  '# Every step below is `&&`-chained, so run-proofs.sh is never reached unless the\n' +
  '# guard passes and this seat actually owns the lock.\n' +
  '#\n' +
  '#   guard exit 1  -> the manifest/environment safety contract is not met\n' +
  '#   flock exit 75 -> another continuation row already holds this target session,\n' +
  '#                    or this exact row is already running against it\n' +
  '#\n' +
  '# Two nested locks, always session-outer then row-inner, so the ordering is\n' +
  '# global and cannot deadlock (both are --nonblock in any case):\n' +
  '#   $K6_PROOF_SESSION_LOCK_PATH  no OTHER continuation row on this target session\n' +
  '#   $K6_PROOF_LOCK_PATH          no second run of THIS row on this target session\n' +
  '#\n' +
  '# If the guard reports an active same-session lock: STOP. That output is a coordination\n' +
  '# failure, not row evidence, and must not be written into EVIDENCE.md. A flock exit of\n' +
  '# 75 is exactly that condition, detected by ownership rather than by report.\n' +
  'command -v flock >/dev/null &&\n' +
  'K6_PROOF_GUARD_VARS="$(OPENCLAW_CANDIDATE_SHA=<FINAL_CANDIDATE_SHA> \\\n' +
  '  OPENCLAW_SESSION_KEY=<SESSION_KEY> \\\n' +
  '  node tools/k6-proofs/scripts/live-run-guard.mjs \\\n' +
  `    --manifest ${manifestPath} --shell --require-lock)" &&\n` +
  'eval "$K6_PROOF_GUARD_VARS" &&\n' +
  '[ "${K6_PROOF_LOCK_REQUIRED:-0}" = "1" ] &&\n' +
  '[ -n "${K6_PROOF_LOCK_PATH:-}" ] &&\n' +
  '[ -n "${K6_PROOF_SESSION_LOCK_PATH:-}" ] &&\n';

const LOCK_WRAP_FIND = 'OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true \\\n./scripts/run-proofs.sh --live ';
const LOCK_WRAP_REPLACE =
  'OPENCLAW_CREATE_DISPOSABLE_SESSIONS=true \\\n' +
  'flock --nonblock --conflict-exit-code 75 "$K6_PROOF_SESSION_LOCK_PATH" \\\n' +
  '  flock --nonblock --conflict-exit-code 75 "$K6_PROOF_LOCK_PATH" \\\n' +
  '    ./scripts/run-proofs.sh --live ';

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

/**
 * Accept either the reviewed original plan or this tool's own corrected output,
 * and say which. Anything else — including a drifted or partially corrected
 * plan — is refused.
 */
function readOneOfPinned(path, accepted, label) {
  let raw;
  try {
    raw = readFileSync(path);
  } catch (err) {
    die(`${label}: cannot read ${path}: ${err.message}`);
  }
  const got = sha256(raw);
  const form = Object.keys(accepted).find((name) => accepted[name] === got);
  if (!form) {
    die(
      `${label}: SHA-256 pin mismatch for ${path}\n` +
        `  actual              ${got}\n` +
        `  accepted (original) ${accepted.original}\n` +
        `  accepted (corrected, idempotent no-op) ${accepted.corrected}\n` +
        '  Refusing to transform an input that is neither the reviewed plan nor its exact corrected form.'
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch (err) {
    die(`${label}: ${path} is not valid JSON: ${err.message}`);
  }
  return { raw, sha256: got, json: parsed, form };
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
/* output post-conditions (fail closed)                                */
/* ------------------------------------------------------------------ */

/**
 * Every invariant the corrected plan must satisfy. Run against freshly
 * transformed rows AND against a corrected plan handed back in as input, so the
 * idempotent no-op path validates before it re-emits rather than trusting a
 * hash alone. Returns the surviving `<FINAL_CANDIDATE_SHA>` site count.
 */
function assertPostConditions(outRows, { report, corpusIds, guardRows }) {
  const byId = new Map(outRows.map((r) => [r.row_id, r]));
  for (const rid of [...guardRows, ...corpusIds, ...EXPECTED.support_ids, 'R-CW-5', 'R-CW-6', 'R-RC-1', 'R-RC-2']) {
    if (!byId.has(rid)) die(`post-condition: expected row ${rid} is absent from the output`);
  }

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

  for (const rid of ['R-CW-5', 'R-CW-6']) {
    if (byId.get(rid).body.includes('live-run-guard.mjs')) {
      die(`MC-09 post-condition: fixture row ${rid} must not claim gateway-session lock enforcement`);
    }
  }

  const rrc2 = byId.get('R-RC-2');
  if (rrc2.body.includes('Same-session concurrency safe: **true**')) die('MC-07 post-condition: R-RC-2 still claims same-session concurrency safety');
  if (!rrc2.body.includes('false (contract override, fail-closed)')) die('MC-07 post-condition: R-RC-2 lacks the explicit procedural override');
  if (!rrc2.body.includes('`R-RC-1` must execute and resolve before R-RC-2')) die('MC-07 post-condition: R-RC-2 lacks the fixed ordering');
  if (!byId.get('R-RC-1').body.includes('R-RC-2 may not be attempted on a session until this row has executed and resolved')) {
    die('MC-08 post-condition: R-RC-1 lacks the family ordering obligation');
  }

  for (const rid of ['R-CW-5', 'R-CW-6']) {
    const row = byId.get(rid);
    if (!row.body.includes('opens no gateway session and takes no same-session lock')) die(`MC-09 post-condition: ${rid} still claims a gateway-session lock`);
    if (!row.body.includes('Serialize on the **fixture resources**')) die(`MC-09 post-condition: ${rid} lacks fixture-resource serialization`);
    if (row.body.includes('Serialize this row under the runner lock and do not overlap another continuation row on the same target session.')) {
      die(`MC-09 post-condition: ${rid} retains the unactionable runner-lock sentence`);
    }
  }

  for (const rid of EXPECTED.support_ids) {
    const row = byId.get(rid);
    if (!row.body.includes('**Not a corpus row.**')) die(`MC-06 post-condition: ${rid} lacks the non-corpus declaration`);
    if (!row.body.includes('NOT a member of the 35-row exact-SHA denominator')) die(`MC-06 post-condition: ${rid} does not state it is outside the 35-row rollup`);
    const ok = row.artifact_subtree.includes('/_static-companions/') || row.artifact_subtree.includes('/gates/preflight/');
    if (!ok) die(`MC-05 post-condition: ${rid} artifact_subtree ${row.artifact_subtree} is not a reviewed non-corpus support location`);
    if (new RegExp(`PROOFS/${CANDIDATE_TOKEN.replace(/[<>]/g, (c) => `\\${c}`)}/${rid}/`).test(row.artifact_subtree)) {
      die(`MC-05 post-condition: ${rid} still occupies a bare corpus row dir`);
    }
  }
  for (const rid of corpusIds) {
    const row = byId.get(rid);
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
  /* ---- MC-03: the serialized rows must really take the lock ---- */
  for (const rid of guardRows) {
    const row = byId.get(rid);
    const ctx = `MC-03 lock post-condition: ${rid}`;
    if (!row.body.includes('live-run-guard.mjs')) die(`${ctx} lacks live-run-guard.mjs`);
    if (!row.body.includes(REVIEWED_STOP_CLAUSE)) die(`${ctx} lost the reviewed fail-closed STOP clause`);
    if (row.body.includes('live-run-guard.mjs \\\n    --manifest tools/k6-proofs/manifests/<row>.json --json')) {
      die(`${ctx} still uses the superseded metadata-only --json guard call`);
    }
    if (countOf(row.body, '--shell --require-lock)" &&') !== 1) {
      die(`${ctx} does not resolve the lock through exactly one fail-closed --shell --require-lock guard call`);
    }
    const declared = /^- Manifest: `([^`]+)`$/m.exec(row.body);
    if (!declared) die(`${ctx} does not declare exactly one manifest path`);
    if (countOf(row.body, `--manifest ${declared[1]} --shell --require-lock`) !== 1) {
      die(`${ctx} locks on a manifest other than its own declared ${declared[1]}`);
    }
    if (countOf(row.body, '<row>.json') !== 0) die(`${ctx} still carries an unresolved <row>.json lock target`);
    if (countOf(row.body, 'eval "$K6_PROOF_GUARD_VARS" &&') !== 1) die(`${ctx} does not import the guard's lock variables`);
    if (countOf(row.body, '[ "${K6_PROOF_LOCK_REQUIRED:-0}" = "1" ] &&') !== 1) {
      die(`${ctx} does not assert that a lock is actually required`);
    }
    if (countOf(row.body, '[ -n "${K6_PROOF_SESSION_LOCK_PATH:-}" ] &&') !== 1) {
      die(`${ctx} does not assert a resolved session-wide lock path`);
    }
    if (countOf(row.body, 'flock --nonblock --conflict-exit-code 75 "$K6_PROOF_SESSION_LOCK_PATH" \\\n  flock --nonblock --conflict-exit-code 75 "$K6_PROOF_LOCK_PATH" \\\n    ./scripts/run-proofs.sh --live ') !== 1) {
      die(`${ctx} does not hold both the session-wide and row locks across the primary run-proofs.sh invocation`);
    }
    if (countOf(row.body, './scripts/run-proofs.sh --live ') !== 1) {
      die(`${ctx} has an unwrapped second primary run command`);
    }
  }
  const lockedCount = outRows.filter((r) => r.body.includes('flock --nonblock --conflict-exit-code 75 "$K6_PROOF_SESSION_LOCK_PATH"')).length;
  if (lockedCount !== EXPECTED.gateway_serialized_needing_guard) {
    die(`MC-03 lock post-condition: exactly ${EXPECTED.gateway_serialized_needing_guard} bodies must hold the same-session lock, found ${lockedCount}`);
  }

  /* ---- MC-11: the both-forms contract must be satisfiable everywhere ---- */
  for (const row of outRows) {
    const mandates = row.body.match(/^\*\*Both-forms mandate:\*\* (.+)$/gm) ?? [];
    if (mandates.length !== 1) die(`MC-11 post-condition: ${row.row_id} declares ${mandates.length} both-forms mandates`);
    const value = mandates[0].replace('**Both-forms mandate:** ', '').trim();
    if (value !== 'required' && value !== 'not applicable') {
      die(`MC-11 post-condition: ${row.row_id} declares an unknown both-forms value ${JSON.stringify(value)}`);
    }
    const incomplete = row.body.includes('A row proving only one surface is **INCOMPLETE**, not `pass`.');
    if (value === 'not applicable') {
      if (incomplete) die(`MC-11 post-condition: ${row.row_id} is not applicable yet still declares a single surface INCOMPLETE`);
      continue;
    }
    if (!incomplete) die(`MC-11 post-condition: ${row.row_id} requires both forms without the INCOMPLETE clause`);
    const tool = /^- This row exercises: [^.]+\. Tool-form sibling row: `([^`]+)`\. Token-form sibling row: `([^`]+)`\.$/m.exec(row.body);
    if (!tool) die(`MC-11 post-condition: ${row.row_id} requires both forms but does not name both siblings`);
    for (const [label, sibling] of [['tool-form', tool[1]], ['token-form', tool[2]]]) {
      if (!byId.has(sibling)) {
        die(`MC-11 post-condition: ${row.row_id} names a ${label} sibling \`${sibling}\` that is not a planned row; the completion contract is unsatisfiable`);
      }
    }
  }

  return candidateTokenSites;
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

function main() {
  const args = parseArgs(process.argv.slice(2));

  const reportIn = readPinned(args.report, PINS.report_sha256, 'review report', false);
  const report = reportIn.json;

  /* ---- report invariants, shared by both input modes (fail closed) ---- */
  if (report.schema !== PINS.report_schema) die(`review report schema is ${report.schema}, expected ${PINS.report_schema}`);
  if (report.verdict !== 'READY_AFTER_MECHANICAL_FIXES') die(`review report verdict is ${report.verdict}; refusing`);
  if (!Array.isArray(report.mechanical_corrections) || report.mechanical_corrections.length !== 17) {
    die('review report must carry exactly 17 mechanical corrections MC-01..MC-17');
  }

  const planIn = readOneOfPinned(
    args.plan,
    { original: PINS.input_plan_sha256, corrected: PINS.corrected_plan_sha256 },
    'input plan'
  );
  const plan = planIn.json;

  /* The corrected form is a validated no-op, not a second transform. */
  if (planIn.form === 'corrected') {
    return runNoOp(args, { planRaw: planIn.raw, plan, report });
  }

  /* ---- input invariants (fail closed) ---- */
  if (plan.schema !== PINS.plan_schema) die(`input plan schema is ${plan.schema}, expected ${PINS.plan_schema}`);
  if (plan.candidate_sha !== null) die('input plan candidate_sha is not null; this tool refuses a frozen-candidate input');
  if (!Array.isArray(plan.rows) || plan.rows.length !== EXPECTED.rows) {
    die(`input plan must carry exactly ${EXPECTED.rows} rows, found ${Array.isArray(plan.rows) ? plan.rows.length : 'none'}`);
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
  const supersessions = {};
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
  /* The reviewed payload is SUPERSEDED: see SUPERSEDED['MC-03'].             */
  {
    const mc = MC.get('MC-03');
    if (mc.kind !== 'insert_in_command_fence') die('MC-03 kind drifted');
    requireAppliesTo(mc, EXPECTED.gateway_serialized_needing_guard);
    const sup = SUPERSEDED['MC-03'];
    if (sha256Text(mc.text) !== sup.reviewed_text_sha256) {
      die(
        'MC-03: the reviewed payload is not the known-defective text this supersession replaces\n' +
          `  expected ${sup.reviewed_text_sha256}\n  actual   ${sha256Text(mc.text)}`
      );
    }
    if (!mc.text.includes('--json')) die('MC-03: reviewed payload no longer matches the reported defect (--json absent)');
    const guarded = new Set(report.assignment.serialized_rows_contract_corrected ?? []);
    for (const rid of mc.applies_to) {
      if (!guarded.has(rid)) die(`MC-03: ${rid} is not in the reviewed serialized set`);
    }
    let sites = 0;
    const lockManifests = {};
    for (const rid of mc.applies_to) {
      const row = rows.get(rid);
      if (countOf(row.body, '```bash') !== 1) die(`MC-03/${rid}: body must hold exactly one bash fence at this stage`);

      /* the lock must be derived from this row's real manifest, not a placeholder */
      const declared = /^- Manifest: `([^`]+)`$/m.exec(row.body);
      if (!declared) die(`MC-03/${rid}: body does not declare exactly one manifest path`);
      const manifestPath = declared[1];
      let manifestJson;
      try {
        manifestJson = JSON.parse(readFileSync(new URL(manifestPath, REPO_ROOT), 'utf8'));
      } catch (err) {
        die(`MC-03/${rid}: declared manifest ${manifestPath} is not readable: ${err.message}`);
      }
      if (manifestJson.rowId !== rid) {
        die(`MC-03/${rid}: declared manifest ${manifestPath} carries rowId ${manifestJson.rowId}`);
      }
      lockManifests[rid] = manifestPath;

      const pre = insertAfterExact(row.body, mc.insert_after, lockPreamble(manifestPath), `MC-03/preamble/${rid}`, 1);
      row.body = pre.text;
      sites += pre.count;

      if (countOf(row.body, LOCK_WRAP_FIND) !== 1) {
        die(`MC-03/${rid}: expected exactly 1 primary run-proofs.sh invocation to wrap in flock`);
      }
      const wrap = replaceExact(row.body, LOCK_WRAP_FIND, LOCK_WRAP_REPLACE, `MC-03/flock/${rid}`);
      row.body = wrap.text;
      sites += wrap.count;
    }
    if (sites !== EXPECTED.gateway_serialized_lock_sites) {
      die(`MC-03: expected ${EXPECTED.gateway_serialized_lock_sites} sites, applied ${sites}`);
    }
    supersessions['MC-03'] = { ...sup, row_manifests: lockManifests };
    record('MC-03', mc.kind, sites, mc.applies_to.length,
      'SUPERSEDED reviewed payload: the reviewed --json call acquired no lock. Now 18 fail-closed lock preambles + 18 flock wrappers that hold the lock for the whole run. Applied before MC-04 so the single pre-existing bash fence is unambiguous.');
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
  /* R-OBS-1's reviewed payload is SUPERSEDED: see SUPERSEDED['MC-11/R-OBS-1'].*/
  {
    const mc = MC.get('MC-11');
    if (mc.kind !== 'append_after_line') die('MC-11 kind drifted');
    requireAppliesTo(mc, EXPECTED.rows);
    const sup = SUPERSEDED['MC-11/R-OBS-1'];
    const reviewedObs = mc.per_row?.['R-OBS-1']?.text;
    if (typeof reviewedObs !== 'string') die('MC-11: no per_row text for R-OBS-1');
    if (sha256Text(reviewedObs) !== sup.reviewed_text_sha256) {
      die(
        'MC-11/R-OBS-1: the reviewed payload is not the known-unsatisfiable text this supersession replaces\n' +
          `  expected ${sup.reviewed_text_sha256}\n  actual   ${sha256Text(reviewedObs)}`
      );
    }
    if (!reviewedObs.includes('Token-form sibling row: `None`')) {
      die('MC-11/R-OBS-1: reviewed payload no longer matches the reported defect (`None` sibling absent)');
    }
    const obsManifest = JSON.parse(readFileSync(new URL('tools/k6-proofs/manifests/r-obs-1.json', REPO_ROOT), 'utf8'));
    if (obsManifest.rowId !== 'R-OBS-1' || obsManifest.mutates !== false) {
      die('MC-11/R-OBS-1: r-obs-1.json is no longer the read-only observability row this supersession relies on');
    }
    let sites = 0;
    for (const rid of mc.applies_to) {
      const spec = mc.per_row?.[rid];
      if (!spec || typeof spec.text !== 'string') die(`MC-11: no per_row text for ${rid}`);
      const text = rid === 'R-OBS-1' ? sup.text : spec.text;
      if (!text.includes('**Both-forms mandate:**')) die(`MC-11/${rid}: per_row text lacks the both-forms mandate`);
      const row = rows.get(rid);
      const r = appendAfterLine(row.body, mc.anchor, text, `MC-11/${rid}`);
      row.body = r.text;
      sites += r.count;
    }
    if (sites !== EXPECTED.rows) die(`MC-11: expected ${EXPECTED.rows} sites, applied ${sites}`);
    supersessions['MC-11/R-OBS-1'] = sup;
    record('MC-11', mc.kind, sites, mc.applies_to.length,
      'SUPERSEDED reviewed payload for R-OBS-1 only: both-forms is now "not applicable" for this read-only session_status row, because the reviewed "required + sibling None" form was unsatisfiable. The other 37 payloads are the reviewed bytes.');
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
  const candidateTokenSites = assertPostConditions(outRows, {
    report,
    corpusIds,
    guardRows: MC.get('MC-03').applies_to,
  });

  /* ---------------- emit ------------------------------------------------- */
  const serialised = buildOutput({
    plan, report, outRows, ledger, rebalance, supersessions, candidateTokenSites,
  });
  writeFileSync(args.out, serialised);
  emitSummary(args, {
    serialised, outRows, ledger, rebalance, supersessions, candidateTokenSites,
    inputMode: 'reviewed-original',
  });
}

/* ------------------------------------------------------------------ */
/* emit                                                                */
/* ------------------------------------------------------------------ */

function buildOutput({ plan, report, outRows, ledger, rebalance, supersessions, candidateTokenSites }) {
  const mc17 = report.mechanical_corrections.find((m) => m.id === 'MC-17');
  const out = {
    schema: plan.schema,
    umbrella_issue: plan.umbrella_issue,
    project: plan.project,
    candidate_sha: null,
    corrections: {
      source_review_commit: PINS.review_commit,
      source_review_report: 'analysis/project86-fold-readiness.json',
      source_review_verdict: report.verdict,
      input_plan_sha256: PINS.input_plan_sha256,
      review_report_sha256: PINS.report_sha256,
      reviewed_inputs: {
        docs_base: PINS.docs_base,
        catalog: PINS.catalog,
        contract: PINS.contract,
        breadcrumbs: PINS.breadcrumbs,
      },
      applied: EXPECTED.applied_corrections,
      superseded: supersessions,
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
          reviewed_precorrection_sites: mc17.counts,
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
  return `${JSON.stringify(out, null, 2)}\n`;
}

function emitSummary(args, { serialised, outRows, ledger, rebalance, supersessions, candidateTokenSites, inputMode }) {
  if (args.stdoutSummary) {
    process.stdout.write(`${JSON.stringify({
      input_mode: inputMode,
      input_plan_sha256: PINS.input_plan_sha256,
      review_report_sha256: PINS.report_sha256,
      output_path: args.out,
      output_sha256: sha256(Buffer.from(serialised)),
      rows: outRows.length,
      corpus_rows: EXPECTED.corpus_rows,
      support_entries: EXPECTED.support_ids,
      candidate_sha: null,
      applied: EXPECTED.applied_corrections,
      superseded: Object.keys(supersessions),
      deferred: EXPECTED.deferred_corrections,
      ledger,
      rebalance_moves: rebalance,
      candidate_token_sites_remaining: candidateTokenSites,
    }, null, 2)}\n`);
  } else {
    process.stderr.write(`wrote ${args.out} (${outRows.length} rows, candidate_sha=null, MC-17 deferred, input=${inputMode})\n`);
  }
}

/* ------------------------------------------------------------------ */
/* idempotence: the corrected form is a validated no-op                */
/* ------------------------------------------------------------------ */

/**
 * Handed its own exact output, the transformer must re-emit those bytes rather
 * than fail the original-plan pin. The corrected bytes are only accepted after
 * the full structural + post-condition battery passes AND a fresh re-emission
 * reproduces them byte for byte, so a drifted or partially corrected plan is
 * still rejected.
 */
function runNoOp(args, { planRaw, plan, report }) {
  if (plan.schema !== PINS.plan_schema) die(`no-op input: schema is ${plan.schema}, expected ${PINS.plan_schema}`);
  if (plan.candidate_sha !== null) die('no-op input: candidate_sha is not null; MC-17 must remain deferred');
  if (!Array.isArray(plan.rows) || plan.rows.length !== EXPECTED.rows) {
    die(`no-op input: expected exactly ${EXPECTED.rows} rows`);
  }

  const c = plan.corrections;
  if (!c || typeof c !== 'object') die('no-op input: corrections block is missing');
  if (c.source_review_commit !== PINS.review_commit) die(`no-op input: corrections.source_review_commit is ${c.source_review_commit}`);
  if (c.source_review_verdict !== report.verdict) die('no-op input: corrections.source_review_verdict disagrees with the pinned report');
  if (c.input_plan_sha256 !== PINS.input_plan_sha256) die('no-op input: corrections.input_plan_sha256 is not the reviewed original plan');
  if (c.review_report_sha256 !== PINS.report_sha256) die('no-op input: corrections.review_report_sha256 is not the pinned review report');
  if (JSON.stringify(c.applied) !== JSON.stringify(EXPECTED.applied_corrections)) die('no-op input: corrections.applied drifted');
  if (c.deferred?.['MC-17']?.status !== 'DEFERRED') die('no-op input: MC-17 is no longer deferred');
  if (c.deferred['MC-17'].candidate_token !== CANDIDATE_TOKEN) die('no-op input: MC-17 candidate token drifted');
  for (const id of EXPECTED.superseded_corrections) {
    const sup = c.superseded?.[id];
    if (!sup) die(`no-op input: supersession record for ${id} is missing`);
    if (sup.reviewed_text_sha256 !== SUPERSEDED[id].reviewed_text_sha256) {
      die(`no-op input: supersession ${id} does not pin the reviewed payload it replaces`);
    }
  }
  const ledgerIds = (c.ledger ?? []).map((entry) => entry.id);
  const wantIds = [...EXPECTED.applied_corrections, ...EXPECTED.deferred_corrections];
  if (JSON.stringify(ledgerIds) !== JSON.stringify(wantIds)) die('no-op input: corrections.ledger is not MC-01..MC-17 in order');
  const mc03Sites = c.ledger.find((entry) => entry.id === 'MC-03')?.sites;
  if (mc03Sites !== EXPECTED.gateway_serialized_lock_sites) {
    die(`no-op input: MC-03 ledger records ${mc03Sites} sites, expected ${EXPECTED.gateway_serialized_lock_sites}`);
  }

  const corpusIds = report.issue_matrix.filter((m) => m.corpus_row === true).map((m) => m.row_id);
  const candidateTokenSites = assertPostConditions(plan.rows, {
    report,
    corpusIds,
    guardRows: report.mechanical_corrections.find((m) => m.id === 'MC-03').applies_to,
  });

  const serialised = buildOutput({
    plan,
    report,
    outRows: plan.rows,
    ledger: c.ledger,
    rebalance: c.rebalance_moves,
    supersessions: c.superseded,
    candidateTokenSites,
  });
  if (serialised !== planRaw.toString('utf8')) {
    die('no-op input: re-emission is not byte-identical to the corrected plan handed in; this input is a drifted variant, not the corrected form');
  }

  writeFileSync(args.out, serialised);
  emitSummary(args, {
    serialised,
    outRows: plan.rows,
    ledger: c.ledger,
    rebalance: c.rebalance_moves,
    supersessions: c.superseded,
    candidateTokenSites,
    inputMode: 'corrected-no-op',
  });
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
