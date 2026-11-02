#!/usr/bin/env node
/**
 * proof-pipe-dry-run.mjs: walk the scheduled proof pipe's stages (a) to (e)
 * without firing anything (docs#587; tools/k6-proofs/docs/PROOF-PIPE-DESIGN.md).
 *
 *   node tools/k6-proofs/scripts/proof-pipe-dry-run.mjs \
 *     --product-sha <40-hex> --docs-sha <40-hex> [--corpus-sha <40-hex>] \
 *     [--rows all|owner:<bucket>|R-A,R-B] [--trigger manual|nightly|on-deploy] \
 *     [--label <slug>] [--proof-seats a,b] [--runner-labels '<runs-on JSON>'] \
 *     [--dry-run true|false] [--json] [--out <file>] [--repo-root <dir>]
 *
 * It validates its inputs, reads the bugs-first hold at the pipeline's own
 * commit, at the docs SHA and at origin/main, resolves rows from
 * PROOFS/<corpus>/proofs-manifest.json::dispatch_allocation at the docs SHA,
 * refuses any consumed or possibly consumed row, and prints the plan and the
 * receipts the pipe would collect. Every byte it reads is a git object at an
 * exact SHA; it never fetches, and git is the only process it starts. No k6,
 * no seat, no gateway, no Temporal, no GitHub.
 *
 * dry_run=false is always refused: exit 3 while the hold is in effect, exit 4
 * once it is lifted, because the live leg is not built. Exit 2 is any other
 * refusal; exit 0 a plan.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveRepositoryRoot } from '../lib/repo-root.mjs';
import {
  CATALOG_DIR,
  EXIT,
  HOLD_PATH,
  PACKET_ROOT,
  PLAN_SCHEMA,
  ROW_NAME_RE,
  SHA40_RE,
  buildPlan,
  combineHold,
  costGuard,
  judgeHold,
  parsePipeInput,
  renderPlan,
  resolveAllocation,
} from '../lib/proof-pipe-plan.mjs';

const FLAGS = {
  '--product-sha': 'productSha',
  '--docs-sha': 'docsSha',
  '--corpus-sha': 'corpusSha',
  '--rows': 'rows',
  '--trigger': 'trigger',
  '--label': 'label',
  '--proof-seats': 'proofSeats',
  '--runner-labels': 'runnerLabels',
  '--dry-run': 'dryRun',
  '--out': 'out',
};

function parseArgs(argv) {
  const raw = {};
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      json = true;
      continue;
    }
    const key = FLAGS[arg];
    if (!key) return { json, problem: `unknown argument: ${JSON.stringify(arg).slice(0, 80)}` };
    const value = argv[index + 1];
    if (value === undefined) return { json, problem: `${arg} needs a value` };
    if (Object.hasOwn(raw, key)) return { json, problem: `${arg} given twice` };
    raw[key] = value;
    index += 1;
  }
  return { json, raw };
}

/**
 * git with ambient repository overrides cleared and replace refs ignored, as
 * run-proofs.sh does. GIT_NO_LAZY_FETCH keeps a partial clone from fetching a
 * missing object behind a read: the planner never fetches.
 */
function gitEnv() {
  const env = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' };
  for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_NAMESPACE']) {
    delete env[name];
  }
  return env;
}

function gitRead(root, args) {
  const result = spawnSync('git', ['-C', root, '--no-replace-objects', ...args], {
    encoding: 'utf8',
    env: gitEnv(),
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw new Error(`git could not run: ${result.error.code ?? result.error.message}`);
  return { ok: result.status === 0, stdout: result.stdout };
}

function isCommit(root, sha) {
  const result = gitRead(root, ['rev-parse', '--verify', '--quiet', `${sha}^{commit}`]);
  return result.ok && result.stdout.trim() === sha;
}

/** A blob's text at `ref:file`, or undefined when there is none. */
function blobText(root, ref, file) {
  const result = gitRead(root, ['cat-file', 'blob', `${ref}:${file}`]);
  return result.ok ? result.stdout : undefined;
}

function blobId(root, ref, file) {
  const result = gitRead(root, ['rev-parse', '--verify', '--quiet', `${ref}:${file}`]);
  return result.ok ? result.stdout.trim() : undefined;
}

/**
 * The entries directly below `dir` at `ref`, NUL-separated so no name is
 * mangled. An absent directory lists nothing (git exits 0); a listing git
 * cannot make throws, because "nothing there" would read as no consumption.
 */
function listTree(root, ref, dir) {
  const result = gitRead(root, ['ls-tree', '-z', ref, '--', `${dir}/`]);
  if (!result.ok) throw new Error(`git could not list ${dir} at ${ref}`);
  return result.stdout.split('\0').filter(Boolean).map((entry) => {
    const tab = entry.indexOf('\t');
    return { type: entry.slice(0, tab).split(' ')[1], path: entry.slice(tab + 1) };
  });
}

function parseJson(text) {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { problem: true };
  }
}

/** Every catalog manifest at the docs SHA, by the row id it declares. */
function readCatalog(root, docsSha) {
  const catalog = new Map();
  for (const { type, path: file } of listTree(root, docsSha, CATALOG_DIR)) {
    if (type !== 'blob' || !file.endsWith('.json')) continue;
    const parsed = parseJson(blobText(root, docsSha, file) ?? '');
    const rowId = parsed.value?.rowId;
    if (typeof rowId !== 'string') continue;
    if (!catalog.has(rowId)) catalog.set(rowId, []);
    catalog.get(rowId).push({ path: file, manifest: parsed.value });
  }
  return catalog;
}

/**
 * Every row of a merged thornfield packet that bears on this trigger, at the
 * docs SHA. ttf writes a packet under its runtime candidate,
 * PROOF-RUNS/<candidate>/<run>/, and names the corpus it planned from in
 * run.json (manifest.corpusSha, and pure). A run is left out only when its
 * candidate is not the product SHA and its run.json is an object naming
 * another corpus by full SHA (and no pure SHA, or another one); every other
 * run counts, an unreadable or unrecognized run.json included.
 *
 * In a counted run, every entry but RUN.md, run.json and ASSEMBLY.md is a
 * row: a directory's row.json gives its state, under the directory's name and
 * under the row its row.json names, when that differs; a row directory with no
 * readable row.json, or a row recorded as a file, keeps the row with no state,
 * which never reads as not-run. Listing goes one level at a time: a recursive
 * ls-tree of a large tree can overflow.
 */
function readPackets(root, docsSha, { productSha, corpusSha }) {
  const packets = [];
  const read = [];
  const runs = [];
  for (const candidate of listTree(root, docsSha, PACKET_ROOT)) {
    if (candidate.type !== 'tree') continue;
    const candidateSha = candidate.path.split('/')[1];
    for (const run of listTree(root, docsSha, candidate.path)) {
      if (run.type !== 'tree') continue;
      const why = packetRunCounts(candidateSha, parseJson(blobText(root, docsSha, `${run.path}/run.json`) ?? '').value, { productSha, corpusSha });
      if (!why) continue;
      runs.push({ dir: run.path, why });
      for (const entry of listTree(root, docsSha, run.path)) {
        const name = entry.path.split('/').at(-1);
        if (PACKET_RUN_FILES.has(name)) continue;
        if (entry.type !== 'tree') {
          packets.push({ path: entry.path, row: name, state: undefined });
          continue;
        }
        const file = `${entry.path}/row.json`;
        read.push(file);
        const recorded = parseJson(blobText(root, docsSha, file) ?? '').value;
        const state = recorded && typeof recorded === 'object' && !Array.isArray(recorded) ? recorded.state : undefined;
        packets.push({ path: file, row: name, state });
        const named = recorded && typeof recorded === 'object' ? recorded.row : undefined;
        if (typeof named === 'string' && named !== name) packets.push({ path: file, row: named, state });
      }
    }
  }
  return { packets, read, runs };
}

/** What the packet writer puts in a run directory beside its rows (and the assembler's ASSEMBLY.md). */
const PACKET_RUN_FILES = new Set(['RUN.md', 'run.json', 'ASSEMBLY.md']);

/** Why a packet run counts toward this trigger, or undefined when it provably does not. */
function packetRunCounts(candidateSha, runJson, { productSha, corpusSha }) {
  if (candidateSha === productSha) return 'candidate is the product SHA';
  if (!runJson || typeof runJson !== 'object' || Array.isArray(runJson)) return 'run.json unreadable';
  const named = runJson.manifest && typeof runJson.manifest === 'object' ? runJson.manifest.corpusSha : undefined;
  if (typeof named !== 'string' || !SHA40_RE.test(named)) return 'run.json names no corpus';
  if (named === corpusSha) return 'planned from this corpus';
  if (runJson.pure !== undefined && (typeof runJson.pure !== 'string' || !SHA40_RE.test(runJson.pure))) return 'run.json pure is not a SHA';
  if (runJson.pure === corpusSha) return 'planned from this corpus';
  return undefined;
}

function emit(result, { json, out }, exitCode) {
  if (out) {
    mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  }
  if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else if (result.stages) process.stdout.write(renderPlan(result));
  else process.stderr.write(`proof-pipe: REFUSED: ${result.problem}\n`);
  process.exitCode = exitCode;
}

function refusal(problem, extra = {}) {
  return { schema: PLAN_SCHEMA, dryRun: extra.dryRun ?? null, refused: true, problem, fired: 0, contacted: [], ...extra };
}

function main() {
  let root;
  let rest;
  try {
    ({ root, rest } = resolveRepositoryRoot({ argv: process.argv.slice(2) }));
  } catch (err) {
    const json = process.argv.includes('--json');
    return emit(refusal(err.message), { json }, EXIT.REFUSED);
  }
  const args = parseArgs(rest);
  const options = { json: args.json, out: args.raw?.out };
  if (args.problem) return emit(refusal(args.problem), options, EXIT.REFUSED);

  // (a) the trigger's inputs, before anything is read.
  const parsed = parsePipeInput(args.raw);
  if (parsed.problem) return emit(refusal(parsed.problem), options, EXIT.REFUSED);
  const { input } = parsed;
  const cost = costGuard(args.raw.runnerLabels);
  if (!cost.ok) return emit(refusal(cost.reason, { dryRun: input.dryRun }), options, EXIT.REFUSED);
  if (!isCommit(root, input.docsSha)) {
    return emit(refusal(`docs-sha ${input.docsSha} is not a commit in this repository (the runner never fetches; fetch it first)`, { dryRun: input.dryRun }), options, EXIT.REFUSED);
  }
  const head = gitRead(root, ['rev-parse', '--verify', 'HEAD^{commit}']);
  if (!head.ok) return emit(refusal('the repository has no HEAD commit', { dryRun: input.dryRun }), options, EXIT.REFUSED);
  const pipelineSha = head.stdout.trim();

  // (e) the hold: at the pipeline's own commit, at the docs SHA and at
  // origin/main; any one holds. The dispatcher picks the first two, so a
  // release counts only once it is on main. No origin/main here is a hold.
  const main = gitRead(root, ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main^{commit}']);
  const mainSha = main.ok ? main.stdout.trim() : undefined;
  const refs = [...new Set([pipelineSha, input.docsSha, ...(mainSha ? [mainSha] : [])])];
  const sources = refs.map((ref) => ({
    ...judgeHold(blobText(root, ref, HOLD_PATH), ref),
    via: [[pipelineSha, 'pipeline'], [input.docsSha, 'docs-sha'], [mainSha, 'origin/main']].filter(([sha]) => sha === ref).map(([, name]) => name),
  }));
  if (!mainSha) sources.push({ ref: 'origin/main', held: true, reason: 'no origin/main in this checkout: a release counts only on main', via: ['origin/main'] });
  const hold = combineHold(sources, process.env.PROOF_PIPE_HOLD);
  if (!input.dryRun) {
    if (hold.held) {
      return emit(refusal('dry_run=false refused: the bugs-first hold is in effect', { dryRun: false, reason: 'held', hold }), options, EXIT.HELD);
    }
    return emit(
      refusal('dry_run=false refused: the live leg is not built (this skeleton plans only)', { dryRun: false, reason: 'live-leg-not-built', hold }),
      options,
      EXIT.LIVE_NOT_BUILT,
    );
  }

  // (a) row authority: the manifest at the docs SHA, and its allocation.
  const manifestPath = `PROOFS/${input.corpusSha}/proofs-manifest.json`;
  const manifestText = blobText(root, input.docsSha, manifestPath);
  if (manifestText === undefined) return emit(refusal(`no ${manifestPath} at docs ${input.docsSha}`, { dryRun: true }), options, EXIT.REFUSED);
  const manifest = parseJson(manifestText).value;
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return emit(refusal(`${manifestPath} at docs ${input.docsSha} is not a JSON object`, { dryRun: true }), options, EXIT.REFUSED);
  }
  if (manifest.schema !== 'openclaw.proofs.manifest.v1') {
    return emit(refusal(`${manifestPath} schema is not openclaw.proofs.manifest.v1`, { dryRun: true }), options, EXIT.REFUSED);
  }
  if (manifest.capture_sha !== input.corpusSha) {
    const named = typeof manifest.capture_sha === 'string' ? manifest.capture_sha.slice(0, 40) : JSON.stringify(manifest.capture_sha ?? null)?.slice(0, 40);
    return emit(refusal(`${manifestPath}: capture_sha ${named} is not the corpus SHA ${input.corpusSha}`, { dryRun: true }), options, EXIT.REFUSED);
  }
  const allocation = resolveAllocation(manifest);
  if (allocation.problem) return emit(refusal(`${manifestPath}: ${allocation.problem}`, { dryRun: true }), options, EXIT.REFUSED);

  let packetLedger;
  try {
    packetLedger = readPackets(root, input.docsSha, input);
  } catch (err) {
    return emit(refusal(`${err.message}: the consumption ledger is unreadable`, { dryRun: true }), options, EXIT.REFUSED);
  }
  let catalog;
  try {
    catalog = readCatalog(root, input.docsSha);
  } catch (err) {
    return emit(refusal(`${err.message}: the row catalog is unreadable`, { dryRun: true }), options, EXIT.REFUSED);
  }
  const built = buildPlan({
    input,
    cost,
    hold,
    pipelineSha,
    manifest,
    manifestPath,
    manifestBlob: blobId(root, input.docsSha, manifestPath),
    allocation,
    catalog,
    packets: packetLedger.packets,
    packetsRead: packetLedger.read,
    packetRuns: packetLedger.runs,
  });
  if (built.problem) return emit(refusal(built.problem, { dryRun: true }), options, EXIT.REFUSED);
  return emit(built.plan, options, built.plan.refused ? EXIT.REFUSED : EXIT.PLANNED);
}

// Anything unforeseen is a refusal, never a stack trace or a plan.
try {
  main();
} catch (err) {
  emit(refusal(`the planner failed: ${String(err?.message ?? 'unknown error').slice(0, 200)}`), { json: process.argv.includes('--json') }, EXIT.REFUSED);
}
