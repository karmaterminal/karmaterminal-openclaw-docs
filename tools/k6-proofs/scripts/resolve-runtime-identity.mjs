#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  classifyRuntimeStamp,
  publicRuntimeIdentity,
  resolveExactRuntimeIdentity,
} from '../lib/runtime-identity.mjs';

function usage() {
  console.error(`Usage: node resolve-runtime-identity.mjs [--write <path>] [--json]
Independently resolve the deployed OpenClaw runtime SHA from a structured
build receipt or installed build metadata. Never copies candidate_sha.`);
}

function parseArgs(argv) {
  const out = { write: '', json: true };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--write') out.write = argv[++i] || '';
    else throw new Error(`unexpected argument: ${arg}`);
  }
  return out;
}

async function readJsonIfPresent(file) {
  if (!file) return null;
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

function runOpenClawVersionJson() {
  const result = spawnSync('openclaw', ['version', '--json'], {
    encoding: 'utf8',
    timeout: 8000,
  });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function runOpenClawVersionStamp() {
  const result = spawnSync('openclaw', ['--version'], {
    encoding: 'utf8',
    timeout: 8000,
  });
  if (result.status !== 0) return null;
  const line = String(result.stdout || '').split(/\r?\n/).find((entry) => entry.trim());
  return line ? line.trim() : null;
}

export async function collectRuntimeIdentitySources(env = process.env) {
  const sources = [];
  const receiptPath = env.OPENCLAW_RUNTIME_BUILD_RECEIPT ||
    env.OPENCLAW_RUNTIME_BUILD_RECEIPT_PATH ||
    '';
  const defaultReceipts = [
    receiptPath,
    path.join(homedir(), '.openclaw', 'runtime-build-receipt.json'),
    path.join(homedir(), '.openclaw', 'build-receipt.json'),
  ].filter(Boolean);
  const seen = new Set();
  for (const file of defaultReceipts) {
    const resolved = path.resolve(file);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    const receipt = await readJsonIfPresent(resolved);
    if (receipt) sources.push({ kind: 'receipt', source: 'runtime-build-receipt', path: resolved, receipt });
  }

  const envStamp = classifyRuntimeStamp(env.OPENCLAW_RUNTIME_BUILD_SHA);
  if (envStamp.kind === 'exact-sha') {
    sources.push({ kind: 'env-exact-sha', source: 'operator-env-exact-sha', sha: envStamp.value });
  } else if (envStamp.kind !== 'absent') {
    sources.push({ kind: 'env-stamp', source: 'operator-env-stamp', stamp: envStamp.value });
  }

  const disableProbes = env.OPENCLAW_RUNTIME_IDENTITY_DISABLE_PROBES === '1' ||
    env.OPENCLAW_RUNTIME_IDENTITY_DISABLE_PROBES === 'true';
  // An operator-supplied exact SHA is already an independent receipt. Probe
  // the installed CLI only when we still need an exact identity, or when an
  // explicit receipt file was supplied as a second source.
  const shouldProbeCli = !disableProbes &&
    (envStamp.kind !== 'exact-sha' || Boolean(receiptPath));
  if (shouldProbeCli) {
    const versionJson = runOpenClawVersionJson();
    if (versionJson) {
      sources.push({
        kind: 'receipt',
        source: 'openclaw-version-json',
        receipt: versionJson,
      });
    }
    const versionStamp = runOpenClawVersionStamp();
    if (versionStamp) {
      sources.push({ kind: 'stamp', source: 'openclaw-version-stamp', stamp: versionStamp });
    }
  }
  return sources;
}

export async function resolveDeployedRuntimeIdentity(env = process.env) {
  const sources = await collectRuntimeIdentitySources(env);
  const identity = resolveExactRuntimeIdentity(sources);
  return publicRuntimeIdentity(identity, { candidateSha: env.OPENCLAW_CANDIDATE_SHA || null });
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  const identity = await resolveDeployedRuntimeIdentity();
  const text = `${JSON.stringify(identity, null, 2)}\n`;
  if (args.write) await writeFile(args.write, text);
  process.stdout.write(text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  });
}
