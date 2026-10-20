#!/usr/bin/env node
/**
 * CLI for the scheduled exact-build baseline (#587).
 *
 *   rollup        fold one run's run-result.json files into the verdict rollup
 *                 (pass/partial/fail/missing, each with its last same-row PASS)
 *   deploy-check  decide whether a deployed SHA still needs a baseline fire
 *   watchdog      report seats whose nightly fire is missing
 *
 * Reads only local files; the workflow fetches artifact listings with gh.
 * Writes GitHub step outputs when GITHUB_OUTPUT is set.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveRepositoryRoot, proofsToolPath } from '../lib/repo-root.mjs';
import {
  artifactName,
  buildRollup,
  classifyCatalog,
  corpusObservations,
  deployCheck,
  historyObservations,
  renderAlert,
  renderRollupMarkdown,
  renderWatchdogAlert,
  watchdog,
} from '../lib/scheduled-baseline.mjs';

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readJsonOrNull(file) {
  try {
    return file && existsSync(file) ? readJson(file) : null;
  } catch {
    return null;
  }
}

/** Accept a JSON array, { artifacts: [...] }, or newline-delimited objects. */
export function parseArtifactListing(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const value = JSON.parse(trimmed);
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.artifacts)) return value.artifacts;
    return [value];
  } catch {
    return trimmed.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  }
}

export function loadCatalog(root) {
  const dir = proofsToolPath(root, 'manifests');
  const manifests = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(path.join(dir, name)));
  return classifyCatalog(manifests);
}

export function loadCorpora(root) {
  const proofs = path.join(root, 'PROOFS');
  if (!existsSync(proofs)) return [];
  const corpora = [];
  for (const sha of readdirSync(proofs)) {
    const manifest = readJsonOrNull(path.join(proofs, sha, 'proofs-manifest.json'));
    if (manifest) corpora.push({ sha, manifest });
  }
  return corpora;
}

function findRunResults(dir, depth = 0, out = []) {
  if (depth > 6 || !existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) findRunResults(full, depth + 1, out);
    else if (name === 'run-result.json') out.push(full);
  }
  return out;
}

/** One entry per run-result.json under the run root, row taken from its metadata. */
export function loadRunResults(runRoot) {
  const results = [];
  for (const file of findRunResults(runRoot)) {
    const result = readJsonOrNull(file);
    if (!result) continue;
    const metadata = readJsonOrNull(path.join(path.dirname(file), 'runner-metadata.json'));
    // <run-root>/<sha>/<ROW>/<seat>/<run>/run-result.json
    const fromPath = path.relative(runRoot, file).split(path.sep).at(-4);
    const row = metadata?.row ?? result.evidence?.row ?? fromPath;
    if (typeof row !== 'string') continue;
    results.push({
      row: row.toUpperCase(),
      verdict: result.verdict ?? null,
      endedAt: result.endedAt ?? null,
      pendingReceipts: result.review?.pendingReceipts ?? [],
    });
  }
  return results;
}

function setOutputs(values) {
  const file = process.env.GITHUB_OUTPUT;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  if (file) appendFileSync(file, `${lines.join('\n')}\n`);
  for (const line of lines) console.log(line);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command, history: [] };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const value = () => {
      const next = rest[++i];
      if (next === undefined) throw new Error(`${arg} requires a value`);
      return next;
    };
    const key = arg.replace(/^--/u, '').replace(/-([a-z])/gu, (_m, c) => c.toUpperCase());
    if (arg === '--history') options.history.push(value());
    else if (arg === '--repo-root') options.repoRoot = value();
    else if (arg.startsWith('--')) options[key] = value();
    else throw new Error(`unexpected argument: ${arg}`);
  }
  return options;
}

function rollupCommand(options) {
  const { root } = resolveRepositoryRoot({ argv: options.repoRoot ? ['--repo-root', options.repoRoot] : [] });
  const catalog = loadCatalog(root);
  const history = options.history.map(readJsonOrNull).filter(Boolean);
  const rollup = buildRollup({
    catalog,
    results: loadRunResults(options.runRoot),
    corpus: corpusObservations(loadCorpora(root)),
    history: historyObservations(history),
    sha: options.sha,
    seat: options.seat,
    docsRef: options.docsRef,
    trigger: options.trigger,
    runUrl: options.runUrl,
    generatedAt: new Date().toISOString(),
    harnessControl: readJsonOrNull(path.join(options.runRoot, 'harness-control-receipt.json')),
    isolatedGateway: readJsonOrNull(options.isolatedGateway),
    deployedBuild: readJsonOrNull(options.deployedBuild),
    blockedAt: options.blockedAt || null,
  });
  mkdirSync(options.out, { recursive: true });
  writeFileSync(path.join(options.out, 'rollup.json'), `${JSON.stringify(rollup, null, 2)}\n`);
  writeFileSync(path.join(options.out, 'rollup.md'), renderRollupMarkdown(rollup));
  if (rollup.alert) writeFileSync(path.join(options.out, 'alert.txt'), `${renderAlert(rollup)}\n`);
  setOutputs({
    fired: rollup.fired,
    alert: rollup.alert,
    regressions: rollup.regressions.join(',') || 'none',
    artifact_name: artifactName({ seat: options.seat, sha: options.sha, trigger: options.trigger, fired: rollup.fired, runId: options.runId }),
  });
  return 0;
}

function deployCheckCommand(options) {
  const artifacts = parseArtifactListing(readFileSync(options.artifacts, 'utf8'));
  const decision = deployCheck({ seat: options.seat, sha: options.sha, artifacts });
  setOutputs({ fire: decision.fire, reason: decision.reason });
  return 0;
}

function watchdogCommand(options) {
  const seats = JSON.parse(options.seats || '[]');
  if (!Array.isArray(seats) || !seats.every((seat) => typeof seat === 'string')) {
    throw new Error('--seats must be a JSON array of seat names');
  }
  const artifacts = parseArtifactListing(readFileSync(options.artifacts, 'utf8'));
  const result = watchdog({
    seats,
    artifacts,
    nightlyCron: options.cron,
    now: options.now ? new Date(options.now) : new Date(),
    graceMinutes: Number(options.graceMinutes ?? 0),
  });
  mkdirSync(options.out, { recursive: true });
  writeFileSync(path.join(options.out, 'watchdog.json'), `${JSON.stringify(result, null, 2)}\n`);
  if (result.alert) writeFileSync(path.join(options.out, 'alert.txt'), `${renderWatchdogAlert(result, options.runUrl)}\n`);
  setOutputs({ alert: result.alert, missed: result.missed.map((entry) => entry.seat).join(',') || 'none' });
  return 0;
}

const COMMANDS = { rollup: rollupCommand, 'deploy-check': deployCheckCommand, watchdog: watchdogCommand };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const command = COMMANDS[options.command];
    if (!command) {
      console.error('Usage: scheduled-baseline.mjs rollup|deploy-check|watchdog [options]');
      process.exit(64);
    }
    process.exit(command(options));
  } catch (error) {
    console.error(`scheduled-baseline: ${error.message}`);
    process.exit(1);
  }
}
