#!/usr/bin/env node
// summary-to-evidence.mjs — transform a k6 scenario's summary.json (+ optional
// captured NDJSON stdout) into a PROOFS/<SHA>/<ROW>/k6-run-<timestamp>/ artifact
// directory: an EVIDENCE.md DRAFT, gateway-events.ndjson, tool-invoke-response.json,
// and task-ledger.json.
//
// SCAFFOLD-LEVEL. k6 is intentionally not a filesystem-heavy evidence author; this
// post-processor does the artifact authoring (the runbook's design). The EVIDENCE.md
// it emits is a DRAFT for a HUMAN to verify + finalize — it carries the candidate
// label k6 produced, never a final corpus verdict.
//
// USAGE:
//   node post-process/summary-to-evidence.mjs \
//     --summary <path/to/summary.json> \
//     [--ndjson <path/to/k6-stdout.ndjson>] \
//     [--out <PROOFS root, default ./PROOFS>] \
//     [--sha <CANDIDATE_SHA override>] [--seat <seat override>]
//
// To capture the NDJSON, tee k6 stdout when you run a scenario:
//   k6 run --summary-export=summary.json scenarios/01-r-cw-1-tool.js | tee k6-stdout.ndjson
// (the harness prints one `NDJSON {json}` line per inbound frame + note).
//
// SECURITY: the operator token never appears in summary.json or inbound frames,
// so these artifacts are safe to commit. The post-processor additionally scrubs
// any value matching the token env var, defensively.

import fs from 'node:fs';
import path from 'node:path';

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}

const summaryPath = arg('summary');
if (!summaryPath) {
  console.error('ERROR: --summary <summary.json> is required.');
  process.exit(2);
}
const ndjsonPath = arg('ndjson');
const outRoot = arg('out', path.resolve(process.cwd(), 'PROOFS'));

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const result = summary.result || {};
const meta = result.meta || {};
const cfg = result.config || {};

const sha = arg('sha', meta.sha || cfg.candidateSha || 'UNVERIFIED-SHA');
const seat = arg('seat', meta.seat || cfg.seat || 'unknown-seat');
const row = summary.row || meta.row || 'UNKNOWN-ROW';
const form = summary.form || meta.form || '';
const ts = new Date().toISOString().replace(/[:.]/g, '-');

const rowVerdict = result.rowCandidate ? result.rowCandidate.rowVerdict : 'UNKNOWN';
const steps = result.rowCandidate ? result.rowCandidate.steps || [] : [];
const facts = result.facts || {};
const notes = result.notes || [];

// ---- defensive token scrub ------------------------------------------------
const tokenVal = process.env.OPENCLAW_GATEWAY_TOKEN;
function scrub(s) {
  if (!tokenVal || typeof s !== 'string') return s;
  return s.split(tokenVal).join('***REDACTED-TOKEN***');
}

// ---- output dir -----------------------------------------------------------
const outDir = path.join(outRoot, sha, row, `k6-run-${ts}`);
fs.mkdirSync(outDir, { recursive: true });

// ---- gateway-events.ndjson (from captured stdout, if provided) ------------
let frameLines = [];
let toolInvokeResponse = null;
let taskLedger = [];
if (ndjsonPath && fs.existsSync(ndjsonPath)) {
  const raw = fs.readFileSync(ndjsonPath, 'utf8').split('\n');
  for (const line of raw) {
    const idx = line.indexOf('NDJSON ');
    if (idx < 0) continue;
    const jsonStr = line.slice(idx + 'NDJSON '.length).trim();
    let obj;
    try { obj = JSON.parse(jsonStr); } catch { continue; }
    frameLines.push(JSON.stringify(obj));
    const parsed = obj.parsed;
    if (parsed) {
      // capture the fire response. The harness tags the fire frame's id with a
      // `fire-` prefix (gateway.js send(..., 'fire')), so a `res` whose id starts
      // with `fire` is the tools.invoke fire response. Also match on the tool
      // names as a fallback for differently-tagged runs.
      const blob = JSON.stringify(parsed);
      const isFireRes = parsed.type === 'res'
        && ((typeof parsed.id === 'string' && /^fire/.test(parsed.id))
          || /continue_work|continue_delegate|tools\.invoke/i.test(blob));
      if (!toolInvokeResponse && isFireRes) toolInvokeResponse = parsed;
      // collect anything task-ledger-shaped (tasks.* responses/events)
      if (/\btask/i.test(blob)) taskLedger.push(parsed);
    }
  }
  fs.writeFileSync(path.join(outDir, 'gateway-events.ndjson'), scrub(frameLines.join('\n')) + '\n');
} else {
  fs.writeFileSync(path.join(outDir, 'gateway-events.ndjson'),
    '# No NDJSON capture provided. Re-run k6 with `| tee k6-stdout.ndjson` and pass --ndjson.\n');
}

// ---- tool-invoke-response.json --------------------------------------------
fs.writeFileSync(
  path.join(outDir, 'tool-invoke-response.json'),
  JSON.stringify(toolInvokeResponse || { note: 'no tools.invoke response captured (provide --ndjson, or this is a token-form/preflight row)' }, null, 2),
);

// ---- task-ledger.json -----------------------------------------------------
fs.writeFileSync(
  path.join(outDir, 'task-ledger.json'),
  JSON.stringify(taskLedger.length ? taskLedger : { note: 'no task-ledger frames captured (provide --ndjson, or N/A for this row)' }, null, 2),
);

// ---- copy the raw summary for provenance ----------------------------------
fs.writeFileSync(path.join(outDir, 'k6-summary.json'), scrub(JSON.stringify(summary, null, 2)));

// ---- EVIDENCE.md DRAFT ----------------------------------------------------
const traceId = (facts.receipts && facts.receipts.traceId) || null;
const tempoUrl = traceId ? `https://tempo.dandelion.cult/api/traces/${traceId}` : null;

const lines = [];
lines.push(`# EVIDENCE (DRAFT) — ${row}${form ? ` (${form} form)` : ''}`);
lines.push('');
lines.push(`> ⚠️ **DRAFT authored by the k6 proof-harness post-processor.** This is a`);
lines.push(`> *candidate* label, **NOT a finalized verdict.** A human must confirm the`);
lines.push(`> transcript meaning + the Tempo trace, then set the verdict per`);
lines.push(`> \`RUNBOOKS/PROOF-CORPUS-METHOD.md\` (✅ PASS / ⚠️ HONEST-LIMIT / 🔴 FAIL).`);
lines.push('');
lines.push(`- **Row:** ${row}`);
if (form) lines.push(`- **Form:** ${form} ${form === 'token' ? '(token/bracket path — INDEPENDENT from the tool; BOTH-FORMS MANDATE)' : '(typed tool path)'}`);
lines.push(`- **Candidate SHA:** \`${sha}\``);
lines.push(`- **Seat:** ${seat}`);
lines.push(`- **Session key:** \`${cfg.sessionKey || 'unknown'}\``);
lines.push(`- **Nonce:** \`${cfg.nonce || 'n/a'}\``);
lines.push(`- **k6 run dir:** \`${path.relative(outRoot, outDir)}\``);
lines.push(`- **Harness candidate label:** **${rowVerdict}**`);
lines.push('');

lines.push('## Spec anchor + per-step labels');
lines.push('');
if (steps.length) {
  for (const s of steps) {
    lines.push(`- **${s.verdict}** — _${s.specAnchor}_`);
    if (s.humanGuidance) lines.push(`  - ${s.humanGuidance}`);
    if (s.evidence && Object.keys(s.evidence).length) {
      lines.push('  - evidence: `' + scrub(JSON.stringify(s.evidence)) + '`');
    }
  }
} else {
  lines.push('- (no per-step labels in summary)');
}
lines.push('');

lines.push('## Receipts');
lines.push('');
lines.push('| receipt | value |');
lines.push('|---|---|');
lines.push(`| trace id | ${traceId ? '`' + traceId + '`' : '**MISSING — capture from Tempo before finalizing**'} |`);
lines.push(`| Tempo URL | ${tempoUrl ? tempoUrl : '_n/a until trace id captured_'} |`);
if (facts.receipts) {
  for (const k of Object.keys(facts.receipts)) {
    if (k === 'traceId') continue;
    lines.push(`| ${k} | \`${scrub(String(facts.receipts[k])).slice(0, 200)}\` |`);
  }
}
if (facts.toolsVisible) {
  for (const t of Object.keys(facts.toolsVisible)) {
    lines.push(`| tool visible: ${t} | ${facts.toolsVisible[t] ? 'VISIBLE' : 'ABSENT (classify per surface)'} |`);
  }
}
lines.push('');

lines.push('## Artifacts in this dir');
lines.push('');
lines.push('- `k6-summary.json` — raw k6 summary (provenance)');
lines.push('- `gateway-events.ndjson` — every inbound gateway frame (token-free)');
lines.push('- `tool-invoke-response.json` — the fire response (tool-form rows)');
lines.push('- `task-ledger.json` — task-ledger frames (delegate rows)');
lines.push('- **TODO (human/companion script):** `wake_event_trace.json` — fetch the Tempo trace JSON for the trace id above');
lines.push('');

lines.push('## Harness notes (chronological)');
lines.push('');
for (const n of notes) {
  lines.push(`- \`${new Date(n.at).toISOString()}\` [${n.kind}] ${scrub(n.message)}`);
}
lines.push('');

lines.push('## Human verdict (fill in)');
lines.push('');
lines.push('- [ ] Transcript meaning confirmed (the behavior actually happened, not just an event shape match)');
lines.push('- [ ] Tempo trace fetched + parent/child span stitch verified');
lines.push(form === 'token'
  ? '- [ ] Confirmed the agent emitted the TERMINAL token/bracket (model-compliance) — the path under test'
  : '- [ ] Confirmed the tool was accepted with the expected args');
lines.push('- [ ] Final verdict: ✅ PASS  /  ⚠️ HONEST-LIMIT  /  🔴 FAIL  (delete the harness candidate caveat once set)');
lines.push('');

fs.writeFileSync(path.join(outDir, 'EVIDENCE.md'), lines.join('\n'));

// ---- report ---------------------------------------------------------------
console.log(`Wrote artifacts to: ${outDir}`);
for (const f of fs.readdirSync(outDir)) console.log(`  - ${f}`);
console.log(`\nHarness candidate label: ${rowVerdict}  (HUMAN VERDICT REQUIRED)`);
if (!traceId) console.log('NOTE: no trace id captured — fetch the Tempo trace before finalizing (Tempo trace requirement).');
