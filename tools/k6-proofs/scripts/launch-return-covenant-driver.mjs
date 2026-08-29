#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from '../lib/canonical-json.mjs';
import {
  childTerminationReason,
  readBoundedCandidateJson,
} from '../lib/return-covenant-candidate-io.mjs';
import {
  createReturnCovenantDriverAttestation,
  inspectProcessLoopbackListeners,
  verifyReturnCovenantDirectCleanup,
} from '../lib/return-covenant-driver-attestation.mjs';
import {
  deriveReturnCovenantCaseHandleClosure,
  deriveReturnCovenantTrustedRetention,
  parseReturnCovenantEvidenceLog,
  resolveReturnCovenantAuthoritativeReceipt,
  RETURN_COVENANT_RETENTION_AUTHORITY,
  validateReturnCovenantAuthoritativeReceipt,
} from '../lib/return-covenant-authoritative-receipt.mjs';
import {
  RETURN_COVENANT_DRIVER_SCHEMA,
  validateReturnCovenantPlan,
} from '../lib/return-covenant-scenario-contract.mjs';
import {
  inspectReturnCovenantDurableStores,
} from '../lib/return-covenant-retention-inspector.mjs';

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultDocsDir = path.resolve(scriptDir, '../../..');
const SANDBOX_EXIT_PREFIX = 'R_CD_RETURN_COVENANT_AUTHORITY_EXIT ';
const DOCS_AUTHORITY_FILES = [
  'tools/k6-proofs/contracts/return-covenant-authority/retention-observation.schema.json',
  'tools/k6-proofs/contracts/return-covenant-authority/scenario.js',
  'tools/k6-proofs/k6-proof-binaries.json',
  'tools/k6-proofs/lib/canonical-json.mjs',
  'tools/k6-proofs/lib/isolated-runtime-plugin-contract.mjs',
  'tools/k6-proofs/lib/return-covenant-authoritative-receipt.mjs',
  'tools/k6-proofs/lib/return-covenant-candidate-io.mjs',
  'tools/k6-proofs/lib/return-covenant-driver-attestation.mjs',
  'tools/k6-proofs/lib/return-covenant-retention-inspector.mjs',
  'tools/k6-proofs/lib/return-covenant-scenario-contract.mjs',
  'tools/k6-proofs/lib/signed-observer-receipt.mjs',
  'tools/k6-proofs/scripts/launch-return-covenant-driver.mjs',
  'tools/k6-proofs/scripts/run-return-covenant-sandbox.mjs',
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function pathWithin(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function sandboxDirectoryArgs(paths) {
  const roots = new Set(['/home', '/root', '/run', '/tmp', '/var/tmp']);
  const directories = new Set();
  for (const value of paths) {
    let current = value;
    while (current !== '/' && !roots.has(current)) {
      directories.add(current);
      current = path.dirname(current);
    }
  }
  return [...directories]
    .toSorted((left, right) =>
      left.split(path.sep).length - right.split(path.sep).length)
    .flatMap((directory) => ['--dir', directory]);
}

function parseArgs(argv) {
  const values = {};
  const allowed = new Set([
    'plan',
    'source-dir',
    'runtime-config',
    'control-dir',
    'artifact-dir',
  ]);
  for (let index = 2; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || !value) {
      throw new Error(
        'usage: --plan <json> --source-dir <product> --runtime-config <json> ' +
        '--control-dir <empty-private-dir> --artifact-dir <empty-private-dir>',
      );
    }
    const name = flag.slice(2);
    if (!allowed.has(name)) throw new Error(`unknown argument: ${flag}`);
    values[name] = value;
  }
  for (const name of [
    'plan',
    'source-dir',
    'runtime-config',
    'control-dir',
    'artifact-dir',
  ]) {
    if (!values[name]) throw new Error(`--${name} is required`);
  }
  return values;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeExclusive(file, value, mode = 0o600) {
  const handle = await open(file, 'wx', mode);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
  } finally {
    await handle.close();
  }
}

async function assertEmptyPrivateDirectory(directory, excludedRoots) {
  const resolved = await realpath(directory);
  const info = await lstat(resolved);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0) {
    throw new Error('--control-dir must be a real mode-0700 private directory');
  }
  if ((await readdir(resolved)).length !== 0) {
    throw new Error('--control-dir must be empty');
  }
  for (const root of excludedRoots) {
    const relative = path.relative(root, resolved);
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
      throw new Error('--control-dir must be outside product, docs, and live state');
    }
  }
  return resolved;
}

async function waitForJson(file, child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const termination = childTerminationReason(child);
    if (termination) {
      throw new Error(`product driver exited before ready (${termination})`);
    }
    try {
      return await readBoundedCandidateJson(file, 131_072);
    } catch (error) {
      if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('product driver ready receipt timed out');
}

async function waitForExit(child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (
    child.exitCode === null &&
    child.signalCode === null &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return child.exitCode ?? (child.signalCode ? 128 : null);
}

async function processStartFingerprint(pid) {
  try {
    const raw = await readFile(`/proc/${pid}/stat`, 'utf8');
    const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/u);
    return fields[19] ? sha256(`${pid}:${fields[19]}`) : null;
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ESRCH') return null;
    throw error;
  }
}

async function processGroupMembers(processGroupId) {
  const members = [];
  for (const entry of await readdir('/proc')) {
    if (!/^[0-9]+$/u.test(entry)) continue;
    try {
      const raw = await readFile(`/proc/${entry}/stat`, 'utf8');
      const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/u);
      if (Number(fields[2]) === processGroupId) members.push(Number(entry));
    } catch (error) {
      if (
        error?.code !== 'ENOENT' &&
        error?.code !== 'EACCES' &&
        error?.code !== 'ESRCH'
      ) throw error;
    }
  }
  return members;
}

async function isDescendantOrSelf(pid, ancestorPid) {
  let current = pid;
  const visited = new Set();
  while (current > 1 && !visited.has(current)) {
    if (current === ancestorPid) return true;
    visited.add(current);
    try {
      const status = await readFile(`/proc/${current}/status`, 'utf8');
      current = Number(status.match(/^PPid:\s+([0-9]+)$/mu)?.[1] || 0);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'EACCES') return false;
      throw error;
    }
  }
  return false;
}

async function sandboxProcessMembers(sandboxPid) {
  const members = [];
  const pending = [sandboxPid];
  const seen = new Set();
  while (pending.length > 0) {
    const pid = pending.shift();
    if (!Number.isInteger(pid) || seen.has(pid)) continue;
    seen.add(pid);
    members.push(pid);
    try {
      const children = (await readFile(
        `/proc/${pid}/task/${pid}/children`,
        'utf8',
      ))
        .trim()
        .split(/\s+/u)
        .filter(Boolean)
        .map(Number);
      pending.push(...children);
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ESRCH') throw error;
    }
  }
  return members;
}

async function inspectGatewayMember({
  pid,
  gatewayPath,
  processGroupId,
  sandboxPid,
  homePath,
  statePath,
  configPath,
  phaseSigningKey,
  gatewayArgs,
  gatewayTokenFingerprint,
  runtimeConfigSha256,
}) {
  const [cmdlineBytes, rawStat] = await Promise.all([
    readFile(`/proc/${pid}/cmdline`),
    readFile(`/proc/${pid}/stat`, 'utf8'),
  ]);
  const executablePath = await realpath(`/proc/${pid}/exe`);
  const expectedNode = await realpath(process.execPath);
  const commandLine = cmdlineBytes.toString('utf8').split('\0').filter(Boolean);
  if (
    commandLine[1] !== gatewayPath ||
    canonicalJson(commandLine.slice(2)) !== canonicalJson(gatewayArgs)
  ) {
    return { ignored: true };
  }
  const environmentBytes = await readFile(`/proc/${pid}/environ`);
  const environment = Object.fromEntries(
    environmentBytes.toString('utf8').split('\0').flatMap((entry) => {
      const separator = entry.indexOf('=');
      return separator > 0 ? [[entry.slice(0, separator), entry.slice(separator + 1)]] : [];
    }),
  );
  const fields = rawStat.slice(rawStat.lastIndexOf(')') + 2).trim().split(/\s+/u);
  const startFingerprint = sha256(`${pid}:${fields[19]}`);
  const namespacePid = await namespacePidForHost(pid);
  const namespaceStartFingerprint = sha256(`${namespacePid}:${fields[19]}`);
  const listeners = await inspectProcessLoopbackListeners(pid);
  const loadedConfigSha256 = sha256(
    canonicalJson(JSON.parse(await readFile(configPath, 'utf8'))),
  );
  const verified =
    executablePath === expectedNode &&
    commandLine[1] === gatewayPath &&
    canonicalJson(commandLine.slice(2)) === canonicalJson(gatewayArgs) &&
    environment.NODE_OPTIONS === undefined &&
    environment.HOME === homePath &&
    environment.OPENCLAW_STATE_DIR === statePath &&
    environment.OPENCLAW_CONFIG_PATH === configPath &&
    environment.OPENCLAW_RETURN_COVENANT_PHASE_KEY === phaseSigningKey &&
    sha256(environment.OPENCLAW_GATEWAY_TOKEN || '') ===
      gatewayTokenFingerprint &&
    loadedConfigSha256 === runtimeConfigSha256 &&
    await isDescendantOrSelf(pid, sandboxPid) &&
    listeners.length > 0;
  return {
    pid,
    startFingerprint,
    namespacePid,
    namespaceStartFingerprint,
    verified,
    endpoints: listeners.map((entry) => entry.endpoint),
    socketFingerprint: sha256(canonicalJson(listeners)),
    listenerFingerprints: listeners
      .map((entry) => entry.socketFingerprint)
      .toSorted(),
    verificationSource: 'direct-environ',
  };
}

async function inspectGatewayMemberWithRetry(params) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await inspectGatewayMember(params);
    } catch (error) {
      if (
        error?.code !== 'ENOENT' &&
        error?.code !== 'EACCES' &&
        error?.code !== 'ESRCH'
      ) throw error;
      try {
        const raw = await readFile(`/proc/${params.pid}/stat`, 'utf8');
        const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/u);
        if (fields[0] === 'Z') return null;
      } catch (statError) {
        if (statError?.code === 'ENOENT' || statError?.code === 'ESRCH') {
          return null;
        }
        if (statError?.code !== 'EACCES') throw statError;
      }
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
  }
  const [cmdlineBytes, rawStat, executablePath, listeners] = await Promise.all([
    readFile(`/proc/${params.pid}/cmdline`),
    readFile(`/proc/${params.pid}/stat`, 'utf8'),
    realpath(`/proc/${params.pid}/exe`),
    inspectProcessLoopbackListeners(params.pid),
  ]);
  const commandLine = cmdlineBytes.toString('utf8').split('\0').filter(Boolean);
  const fields = rawStat.slice(rawStat.lastIndexOf(')') + 2).trim().split(/\s+/u);
  const namespacePid = await namespacePidForHost(params.pid);
  const namespaceStartFingerprint = sha256(`${namespacePid}:${fields[19]}`);
  const loadedConfigSha256 = sha256(
    canonicalJson(JSON.parse(await readFile(params.configPath, 'utf8'))),
  );
  const verified =
    executablePath === await realpath(process.execPath) &&
    commandLine[1] === params.gatewayPath &&
    canonicalJson(commandLine.slice(2)) === canonicalJson(params.gatewayArgs) &&
    await isDescendantOrSelf(params.pid, params.sandboxPid) &&
    loadedConfigSha256 === params.runtimeConfigSha256 &&
    listeners.length > 0;
  if (!verified) {
    throw new Error(`persistent unverifiable gateway pid ${params.pid}`);
  }
  return {
    pid: params.pid,
    startFingerprint: sha256(`${params.pid}:${fields[19]}`),
    namespacePid,
    namespaceStartFingerprint,
    verified: true,
    endpoints: listeners.map((entry) => entry.endpoint),
    socketFingerprint: sha256(canonicalJson(listeners)),
    listenerFingerprints: listeners
      .map((entry) => entry.socketFingerprint)
      .toSorted(),
    verificationSource: 'namespace-inherited',
  };
}

async function namespacePidForHost(pid) {
  const status = await readFile(`/proc/${pid}/status`, 'utf8');
  const values = status.match(/^NSpid:\s+(.+)$/mu)?.[1]
    ?.trim()
    .split(/\s+/u)
    .map(Number);
  return values?.at(-1) || pid;
}

async function resolveReadyHostPids({
  processGroupId,
  ready,
  driverPath,
  driverArgs,
  gatewayPath,
  gatewayArgs,
  homePath,
  statePath,
  configPath,
  phaseSigningKey,
  gatewayTokenFingerprint,
}) {
  let lastDebug = [];
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const matches = { driverPid: null, gatewayPid: null };
    const debug = [];
    for (const pid of await sandboxProcessMembers(processGroupId)) {
      try {
        const [cmdlineBytes, environmentBytes, rawStat, listeners] =
          await Promise.all([
            readFile(`/proc/${pid}/cmdline`),
            readFile(`/proc/${pid}/environ`),
            readFile(`/proc/${pid}/stat`, 'utf8'),
            inspectProcessLoopbackListeners(pid),
          ]);
        const commandLine = cmdlineBytes.toString('utf8').split('\0').filter(Boolean);
        const environment = Object.fromEntries(
          environmentBytes.toString('utf8').split('\0').flatMap((entry) => {
            const separator = entry.indexOf('=');
            return separator > 0
              ? [[entry.slice(0, separator), entry.slice(separator + 1)]]
              : [];
          }),
        );
        const fields = rawStat.slice(rawStat.lastIndexOf(')') + 2)
          .trim()
          .split(/\s+/u);
        const environmentMatches =
          environment.HOME === homePath &&
          environment.OPENCLAW_STATE_DIR === statePath &&
          environment.OPENCLAW_CONFIG_PATH === configPath &&
          environment.OPENCLAW_RETURN_COVENANT_PHASE_KEY === phaseSigningKey &&
          sha256(environment.OPENCLAW_GATEWAY_TOKEN || '') ===
            gatewayTokenFingerprint &&
          await isDescendantOrSelf(pid, processGroupId);
        if (!environmentMatches) continue;
        const endpoints = new Set(listeners.map((entry) => entry.endpoint));
        debug.push({
          pid,
          commandLine: commandLine.slice(0, 4),
          home: environment.HOME,
          state: environment.OPENCLAW_STATE_DIR,
          config: environment.OPENCLAW_CONFIG_PATH,
          endpoints: [...endpoints],
        });
        if (
          commandLine[1] === driverPath &&
          canonicalJson(commandLine.slice(2)) === canonicalJson(driverArgs) &&
          endpoints.has(new URL(ready.endpoint).origin)
        ) {
          matches.driverPid = pid;
        }
        if (
          commandLine[1] === gatewayPath &&
          canonicalJson(commandLine.slice(2)) === canonicalJson(gatewayArgs) &&
          endpoints.has(new URL(ready.gatewayEndpoint).origin)
        ) {
          matches.gatewayPid = pid;
        }
      } catch (error) {
        if (
          error?.code !== 'ENOENT' &&
          error?.code !== 'EACCES' &&
          error?.code !== 'ESRCH'
        ) throw error;
      }
    }
    lastDebug = debug;
    if (matches.driverPid && matches.gatewayPid) return matches;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    `could not bind sandbox namespace PIDs to host processes: ${JSON.stringify(lastDebug)}`,
  );
}

function signalProcessGroup(processGroupId, signal) {
  try {
    process.kill(-processGroupId, signal);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

async function terminateProcessGroup(processGroupId) {
  signalProcessGroup(processGroupId, 'SIGTERM');
  const graceDeadline = Date.now() + 2_000;
  while (
    (await processGroupMembers(processGroupId)).length > 0 &&
    Date.now() < graceDeadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  if ((await processGroupMembers(processGroupId)).length > 0) {
    signalProcessGroup(processGroupId, 'SIGKILL');
  }
}

async function waitForShutdownSettlement({
  processGroupId,
  driverPid,
  gatewayPid,
  timeoutMs = 2_000,
}) {
  const deadline = Date.now() + timeoutMs;
  let emptySamples = 0;
  while (Date.now() < deadline) {
    const [members, driverStart, gatewayStart] = await Promise.all([
      processGroupMembers(processGroupId),
      processStartFingerprint(driverPid),
      processStartFingerprint(gatewayPid),
    ]);
    if (
      members.length === 0 &&
      driverStart === null &&
      gatewayStart === null
    ) {
      emptySamples += 1;
      if (emptySamples === 2) return new Date().toISOString();
    } else {
      emptySamples = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('isolated process group did not reach bounded shutdown settlement');
}

async function resolveLiveGatewayBinding({
  observedGateways,
  target,
  timeoutMs = 750,
}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = [...observedGateways.values()].find((entry) =>
      entry.verified === true &&
      entry.exitedAtMonotonicMs === null &&
      entry.namespacePid === target?.namespacePid &&
      entry.namespaceStartFingerprint === target?.namespaceStartFingerprint &&
      entry.endpoints.includes(target?.endpoint));
    if (match) {
      return {
        pid: match.pid,
        startFingerprint: match.startFingerprint,
        socketFingerprint: match.socketFingerprint,
        endpoint: target.endpoint,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return null;
}

async function existingLivePaths() {
  const candidates = [
    process.env.HOME,
    process.env.OPENCLAW_STATE_DIR,
    process.env.OPENCLAW_CONFIG_PATH,
  ].filter(Boolean);
  const values = [];
  for (const candidate of candidates) {
    try {
      values.push(await realpath(candidate));
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ESRCH') {
        throw error;
      }
    }
  }
  return [...new Set(values)];
}

async function verifySnapshotCommand({
  snapshotPath,
  relativePath,
  candidateSha,
  expectedSha256,
}) {
  const target = path.resolve(snapshotPath, relativePath);
  const [snapshotRoot, targetInfo, targetReal, treeEntry] = await Promise.all([
    realpath(snapshotPath),
    lstat(target),
    realpath(target),
    execFileAsync('git', [
      '-C',
      snapshotPath,
      'ls-tree',
      candidateSha,
      '--',
      relativePath,
    ], { encoding: 'utf8' }).then((result) => result.stdout.trim()),
  ]);
  if (
    !pathWithin(targetReal, snapshotRoot) ||
    targetReal !== target ||
    !targetInfo.isFile() ||
    targetInfo.isSymbolicLink()
  ) {
    throw new Error('candidate command must be a contained regular non-symlink file');
  }
  const treeMatch = treeEntry.match(
    /^(100644|100755) blob ([a-f0-9]{40,64})\t(.+)$/u,
  );
  if (!treeMatch || treeMatch[3] !== relativePath) {
    throw new Error('candidate command is not a regular Git blob');
  }
  const handle = await open(
    target,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  try {
    const handleInfo = await handle.stat();
    if (
      !handleInfo.isFile() ||
      handleInfo.dev !== targetInfo.dev ||
      handleInfo.ino !== targetInfo.ino
    ) {
      throw new Error('candidate command changed during verification');
    }
    const bytes = await handle.readFile();
    const workingBlob = (await execFileAsync('git', [
      '-C',
      snapshotPath,
      'hash-object',
      '--',
      relativePath,
    ], { encoding: 'utf8' })).stdout.trim();
    if (
      workingBlob !== treeMatch[2] ||
      sha256(bytes) !== expectedSha256
    ) {
      throw new Error('candidate command bytes differ from the frozen plan');
    }
  } finally {
    await handle.close();
  }
  return { path: target, gitMode: treeMatch[1] };
}

async function preparePinnedK6({ docsDir, runRoot }) {
  const policy = await readJson(
    path.join(docsDir, 'tools/k6-proofs/k6-proof-binaries.json'),
  );
  const platformKey = `${process.platform}-${process.arch}`;
  const expected = policy?.schema === 'openclaw.k6.proof-binaries.v1'
    ? policy.entries?.[platformKey]
    : null;
  if (!expected) {
    throw new Error(`no reviewed k6 binary policy for ${platformKey}`);
  }
  const sourcePath = '/home/figs/bin/k6';
  const sourceInfo = await lstat(sourcePath);
  if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
    throw new Error('reviewed k6 source path is not a regular file');
  }
  const handle = await open(
    sourcePath,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  let bytes;
  try {
    const handleInfo = await handle.stat();
    if (
      !handleInfo.isFile() ||
      handleInfo.dev !== sourceInfo.dev ||
      handleInfo.ino !== sourceInfo.ino
    ) {
      throw new Error('k6 binary changed during verification');
    }
    bytes = await handle.readFile();
  } finally {
    await handle.close();
  }
  if (sha256(bytes) !== expected.sha256) {
    throw new Error(`k6 binary digest is not approved for ${platformKey}`);
  }
  const copyPath = path.join(runRoot, 'k6');
  await writeFile(copyPath, bytes, { mode: 0o500, flag: 'wx' });
  const copyHandle = await open(
    copyPath,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
  );
  const copyInfo = await copyHandle.stat();
  if (!copyInfo.isFile() || sha256(await copyHandle.readFile()) !== expected.sha256) {
    await copyHandle.close();
    throw new Error('launcher k6 copy differs from reviewed bytes');
  }
  await unlink(copyPath);
  return {
    handle: copyHandle,
    version: expected.version,
    sha256: expected.sha256,
    sourcePathFingerprint: sha256(sourcePath),
  };
}

async function assertDocsIdentity(docsDir, expectedSha) {
  const [head, status] = await Promise.all([
    execFileAsync('git', ['-C', docsDir, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).then((result) => result.stdout.trim()),
    execFileAsync('git', [
      '-C',
      docsDir,
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
      '--',
      ...DOCS_AUTHORITY_FILES,
    ], { encoding: 'utf8' }).then((result) => result.stdout.trim()),
  ]);
  if (head !== expectedSha || status !== '') {
    throw new Error('executing docs harness changed before final signing');
  }
  for (const relativePath of DOCS_AUTHORITY_FILES) {
    const file = path.join(docsDir, relativePath);
    const [info, resolved, treeEntry, workingBlob] = await Promise.all([
      lstat(file),
      realpath(file),
      execFileAsync('git', [
        '-C',
        docsDir,
        'ls-tree',
        expectedSha,
        '--',
        relativePath,
      ], { encoding: 'utf8' }).then((result) => result.stdout.trim()),
      execFileAsync('git', [
        '-C',
        docsDir,
        'hash-object',
        '--',
        relativePath,
      ], { encoding: 'utf8' }).then((result) => result.stdout.trim()),
    ]);
    const match = treeEntry.match(
      /^(100644|100755) blob ([a-f0-9]{40,64})\t(.+)$/u,
    );
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      resolved !== file ||
      !match ||
      match[2] !== workingBlob ||
      match[3] !== relativePath
    ) {
      throw new Error(`docs authority file is not frozen: ${relativePath}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const docsDir = await realpath(defaultDocsDir);
  const sourceDir = await realpath(args['source-dir']);
  const livePaths = await existingLivePaths();
  const controlDir = await assertEmptyPrivateDirectory(
    args['control-dir'],
    [docsDir, sourceDir, ...livePaths],
  );
  const artifactDir = await assertEmptyPrivateDirectory(
    args['artifact-dir'],
    [docsDir, sourceDir, controlDir, ...livePaths],
  );
  const [plan, runtimeConfig] = await Promise.all([
    readJson(args.plan),
    readJson(args['runtime-config']),
  ]);
  const planErrors = validateReturnCovenantPlan(plan);
  if (planErrors.length > 0) {
    throw new Error(`invalid return covenant plan: ${planErrors.join('; ')}`);
  }
  if (sha256(canonicalJson(runtimeConfig)) !== plan.target.runtimeConfigSha256) {
    throw new Error('runtime config differs from the frozen plan digest');
  }
  await assertDocsIdentity(docsDir, plan.target.docsHarnessSha);

  const runRoot = await mkdtemp(path.join(controlDir, 'run-'));
  await chmod(runRoot, 0o700);
  const snapshotPath = path.join(runRoot, 'snapshot');
  const homePath = path.join(runRoot, 'home');
  const statePath = path.join(runRoot, 'state');
  const k6HomePath = path.join(runRoot, 'k6-home');
  const configDir = path.join(runRoot, 'config');
  const ipcDir = path.join(runRoot, 'ipc');
  const attestationDir = path.join(runRoot, 'attestation');
  const retentionSnapshotsPath = path.join(runRoot, 'retention-snapshots');
  const configPath = path.join(configDir, 'openclaw.json');
  const k6ConfigPath = path.join(configDir, 'k6.json');
  const privatePlanPath = path.join(configDir, 'plan.json');
  const readyPath = path.join(controlDir, 'driver-ready.json');
  const attestationPath = path.join(controlDir, 'driver-attestation.json');
  const candidateCleanupDiagnosticPath = path.join(
    controlDir,
    'candidate-cleanup-diagnostic.json',
  );
  const candidateReadyPath = path.join(ipcDir, 'driver-ready.json');
  const candidateAttestationPath = path.join(
    attestationDir,
    'driver-attestation.json',
  );
  const candidateCleanupDraftPath = path.join(ipcDir, 'cleanup-draft.json');
  const cleanupPath = path.join(controlDir, 'cleanup.json');
  const driverLogPath = path.join(controlDir, 'driver.log');
  const k6LogPath = path.join(controlDir, 'k6.log');
  const k6ExitCodePath = path.join(controlDir, 'k6-exit-code.txt');
  let child;
  let sandboxClosed;
  let pinnedK6;
  let capturedK6Log = '';
  let capturedDriverLog = '';
  let actualK6ExitCode = null;
  let attestation;
  let ready;
  let completed = false;
  let monitorActive = false;
  let monitorError = null;
  let monitorPromise = null;
  let liveStoreObservationPromise = null;
  const observedGateways = new Map();
  const handleTermination = () => {
    if (child) void terminateProcessGroup(child.pid);
  };
  process.once('SIGINT', handleTermination);
  process.once('SIGTERM', handleTermination);

  try {
    await execFileAsync('git', [
      'clone',
      '--quiet',
      '--no-hardlinks',
      '--no-checkout',
      sourceDir,
      snapshotPath,
    ]);
    await execFileAsync('git', [
      '-C',
      snapshotPath,
      '-c',
      'advice.detachedHead=false',
      'checkout',
      '--quiet',
      '--detach',
      plan.target.candidateSha,
    ]);
    await Promise.all([
      mkdir(homePath, { mode: 0o700 }),
      mkdir(statePath, { mode: 0o700 }),
      mkdir(k6HomePath, { mode: 0o700 }),
      mkdir(configDir, { mode: 0o700 }),
      mkdir(ipcDir, { mode: 0o700 }),
      mkdir(attestationDir, { mode: 0o700 }),
      mkdir(retentionSnapshotsPath, { mode: 0o700 }),
    ]);
    pinnedK6 = await preparePinnedK6({ docsDir, runRoot });
    await Promise.all([
      writeFile(configPath, `${JSON.stringify(runtimeConfig, null, 2)}\n`, {
        mode: 0o600,
        flag: 'wx',
      }),
      writeFile(privatePlanPath, `${JSON.stringify(plan, null, 2)}\n`, {
        mode: 0o600,
        flag: 'wx',
      }),
      writeFile(k6ConfigPath, '{}\n', {
        mode: 0o400,
        flag: 'wx',
      }),
    ]);
    const [driverCommand, gatewayCommand] = await Promise.all([
      verifySnapshotCommand({
        snapshotPath,
        relativePath: plan.driver.fixtureCommand.relativePath,
        candidateSha: plan.target.candidateSha,
        expectedSha256: plan.driver.fixtureCommand.sha256,
      }),
      verifySnapshotCommand({
        snapshotPath,
        relativePath: plan.driver.gatewayCommand.relativePath,
        candidateSha: plan.target.candidateSha,
        expectedSha256: plan.driver.gatewayCommand.sha256,
      }),
    ]);
    const driverPath = driverCommand.path;
    const gatewayPath = gatewayCommand.path;
    await Promise.all([
      chmod(driverPath, driverCommand.gitMode === '100755' ? 0o500 : 0o400),
      ...(gatewayPath === driverPath
        ? []
        : [chmod(gatewayPath, gatewayCommand.gitMode === '100755' ? 0o500 : 0o400)]),
    ]);
    const launchNonce = randomBytes(32).toString('hex');
    const phaseSigningKey = randomBytes(32).toString('hex');
    const observerSigningKey = randomBytes(32).toString('hex');
    const gatewayToken = randomBytes(32).toString('hex');
    const { NODE_OPTIONS: _nodeOptions, ...baseEnvironment } = process.env;
    const driverArgs = [
      driverPath,
      '--contract',
      RETURN_COVENANT_DRIVER_SCHEMA,
      '--plan',
      privatePlanPath,
      '--ready',
      candidateReadyPath,
      '--cleanup-draft',
      candidateCleanupDraftPath,
    ];
    const scenarioPath = path.join(
      docsDir,
      'tools/k6-proofs/contracts/return-covenant-authority/scenario.js',
    );
    const supervisorPath = path.join(
      docsDir,
      'tools/k6-proofs/scripts/run-return-covenant-sandbox.mjs',
    );
    const bwrapPath = '/usr/bin/bwrap';
    const bwrapInfo = await lstat(bwrapPath);
    if (!bwrapInfo.isFile() || bwrapInfo.isSymbolicLink()) {
      throw new Error('bubblewrap isolation is unavailable');
    }
    const bwrapArgs = [
      '--unshare-user',
      '--unshare-pid',
      '--unshare-net',
      '--unshare-ipc',
      '--die-with-parent',
      '--ro-bind', '/', '/',
      '--tmpfs', '/home',
      '--tmpfs', '/root',
      '--tmpfs', '/run',
      '--tmpfs', '/tmp',
      '--tmpfs', '/var/tmp',
      '--proc', '/proc',
      '--dev', '/dev',
      ...sandboxDirectoryArgs([
        path.dirname(process.execPath),
        docsDir,
        snapshotPath,
        homePath,
        statePath,
        k6HomePath,
        ipcDir,
        attestationDir,
        configDir,
      ]),
      '--ro-bind', process.execPath, process.execPath,
      '--ro-bind', docsDir, docsDir,
      '--bind', homePath, homePath,
      '--bind', statePath, statePath,
      '--bind', k6HomePath, k6HomePath,
      '--bind', ipcDir, ipcDir,
      '--ro-bind', attestationDir, attestationDir,
      '--ro-bind', configDir, configDir,
      '--ro-bind', snapshotPath, snapshotPath,
      '--chdir', snapshotPath,
      '--clearenv',
      '--setenv', 'PATH', baseEnvironment.PATH || '',
      '--setenv', 'LANG', baseEnvironment.LANG || 'C.UTF-8',
      '--setenv', 'HOME', homePath,
      '--setenv', 'OPENCLAW_STATE_DIR', statePath,
      '--setenv', 'OPENCLAW_CONFIG_PATH', configPath,
      '--setenv', 'OPENCLAW_GATEWAY_TOKEN', gatewayToken,
      '--setenv', 'OPENCLAW_RETURN_COVENANT_LAUNCH_NONCE', launchNonce,
      '--setenv', 'OPENCLAW_RETURN_COVENANT_PHASE_KEY', phaseSigningKey,
      '--setenv', 'OPENCLAW_RETURN_COVENANT_PHASE_KEY_FINGERPRINT',
      sha256(phaseSigningKey),
      '--setenv', 'OPENCLAW_RETURN_COVENANT_ATTESTATION_PATH',
      candidateAttestationPath,
      '--setenv', 'OPENCLAW_CANDIDATE_SHA', plan.target.candidateSha,
      '--setenv', 'OPENCLAW_PROOFS_DOCS_REF', plan.target.docsHarnessSha,
      process.execPath,
      supervisorPath,
      '--driver', driverPath,
      '--driver-args', JSON.stringify(driverArgs.slice(1)),
      '--attestation', candidateAttestationPath,
      '--k6', '/proc/self/fd/3',
      '--k6-config', k6ConfigPath,
      '--k6-home', k6HomePath,
      '--scenario', scenarioPath,
      '--plan', privatePlanPath,
    ];
    child = spawn(bwrapPath, bwrapArgs, {
      cwd: snapshotPath,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe', pinnedK6.handle.fd],
      env: { PATH: baseEnvironment.PATH || '' },
    });
    sandboxClosed = new Promise((resolve) => child.once('close', resolve));
    child.stdout.on('data', (chunk) => {
      capturedK6Log += chunk.toString('utf8');
      if (capturedK6Log.length > 20_000_000) {
        void terminateProcessGroup(child.pid);
      }
      if (!liveStoreObservationPromise) {
        const line = capturedK6Log
          .split(/\r?\n/u)
          .find((entry) => entry.includes(
            'R_CD_RETURN_COVENANT_AUTHORITY_EVIDENCE ',
          ));
        const offset = line?.indexOf(
          'R_CD_RETURN_COVENANT_AUTHORITY_EVIDENCE ',
        ) ?? -1;
        if (offset >= 0) {
          try {
            const liveEvidence = JSON.parse(
              line.slice(
                offset +
                  'R_CD_RETURN_COVENANT_AUTHORITY_EVIDENCE '.length,
              ),
            );
            liveStoreObservationPromise = (async () => {
              const target = liveEvidence.retentionObservation?.target;
              const liveGateway = await resolveLiveGatewayBinding({
                observedGateways,
                target,
              });
              return await inspectReturnCovenantDurableStores({
                plan,
                evidence: liveEvidence,
                statePath,
                snapshotPath: path.join(retentionSnapshotsPath, 'live'),
                runtimeProcess: {
                  processGroupId: child.pid,
                  driver: {
                    pid: ready.pid,
                    startFingerprint:
                      attestation.isolation.driverStartFingerprint,
                  },
                  gateway: liveGateway ?? {
                    pid: ready.gatewayPid,
                    startFingerprint:
                      attestation.gateway.startFingerprint,
                    socketFingerprint:
                      attestation.gateway.socketFingerprint,
                    endpoint: target?.endpoint ??
                      attestation.gateway.endpoint,
                  },
                  shutdownSettledAt: null,
                },
                expectedRuntimeAlive: true,
              });
            })();
          } catch {
            // Wait for the complete newline-delimited evidence record.
          }
        }
      }
    });
    child.stderr.on('data', (chunk) => {
      capturedDriverLog += chunk.toString('utf8');
      if (capturedDriverLog.length > 5_000_000) {
        void terminateProcessGroup(child.pid);
      }
    });
    const spawned = new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    await pinnedK6.handle.close();
    pinnedK6.handle = null;
    await spawned;
    const namespaceReady = await waitForJson(candidateReadyPath, child);
    const hostPids = await resolveReadyHostPids({
      processGroupId: child.pid,
      ready: namespaceReady,
      driverPath,
      driverArgs: driverArgs.slice(1),
      gatewayPath,
      gatewayArgs: plan.driver.gatewayCommand.args,
      homePath,
      statePath,
      configPath,
      phaseSigningKey,
      gatewayTokenFingerprint: sha256(gatewayToken),
    });
    ready = {
      ...namespaceReady,
      namespacePid: namespaceReady.pid,
      namespaceGatewayPid: namespaceReady.gatewayPid,
      pid: hostPids.driverPid,
      gatewayPid: hostPids.gatewayPid,
    };
    await writeExclusive(readyPath, ready);
    attestation = await createReturnCovenantDriverAttestation({
      plan,
      sourceDir: snapshotPath,
      docsDir,
      ready,
      launch: {
        createdByTrustedLauncher: true,
        launcherPid: process.pid,
        launcherStartFingerprint: await processStartFingerprint(process.pid),
        driverPid: ready.pid,
        sandboxPid: child.pid,
        sandboxStartFingerprint: await processStartFingerprint(child.pid),
        processGroupId: child.pid,
        launchNonce,
        phaseSigningKey,
        observerKeyFingerprint: sha256(observerSigningKey),
        driverArgs: driverArgs.slice(1),
        gatewayTokenFingerprint: sha256(gatewayToken),
        runRoot,
        homePath,
        statePath,
        configPath,
        snapshotPath,
        livePaths,
      },
    });
    await writeExclusive(attestationPath, attestation);
    await writeExclusive(candidateAttestationPath, attestation);
    process.stdout.write(`${JSON.stringify({
      status: 'ready',
      candidateSha: plan.target.candidateSha,
      attestation: path.basename(attestationPath),
      endpoint: attestation.endpoint,
    })}\n`);

    monitorActive = true;
    const initialGatewayKey =
      `${ready.gatewayPid}:${attestation.gateway.startFingerprint}`;
    const initialSampleAt = performance.now();
    const initialSampleWall = new Date().toISOString();
    observedGateways.set(
      initialGatewayKey,
      {
        pid: ready.gatewayPid,
        startFingerprint: attestation.gateway.startFingerprint,
        namespacePid: attestation.gateway.namespacePid,
        namespaceStartFingerprint:
          attestation.gateway.namespaceStartFingerprint,
        verified: true,
        endpoints: [attestation.gateway.endpoint],
        socketFingerprint: attestation.gateway.socketFingerprint,
        listenerFingerprints: attestation.gateway.listenerFingerprints,
        verificationSource: 'direct-environ',
        firstSeenMonotonicMs: initialSampleAt,
        lastSeenMonotonicMs: initialSampleAt,
        exitedAtMonotonicMs: null,
        firstSeenAt: initialSampleWall,
        lastSeenAt: initialSampleWall,
        exitedAt: null,
      },
    );
    monitorPromise = (async () => {
      while (monitorActive) {
        const members = await sandboxProcessMembers(child.pid);
        const memberSet = new Set(members);
        const exitObservedAt = performance.now();
        const exitObservedWall = new Date().toISOString();
        for (const [key, observation] of observedGateways) {
          if (
            observation.exitedAtMonotonicMs === null &&
            !memberSet.has(observation.pid)
          ) {
            observedGateways.set(key, {
              ...observation,
              exitedAtMonotonicMs: exitObservedAt,
              exitedAt: exitObservedWall,
            });
          }
        }
        for (const pid of members) {
          if (pid === child.pid || pid === ready.pid) continue;
          try {
            const observation = await inspectGatewayMemberWithRetry({
              pid,
              gatewayPath,
              processGroupId: child.pid,
              sandboxPid: child.pid,
              homePath,
              statePath,
              configPath,
              phaseSigningKey,
              gatewayArgs: plan.driver.gatewayCommand.args,
              gatewayTokenFingerprint: sha256(gatewayToken),
              runtimeConfigSha256: plan.target.runtimeConfigSha256,
            });
            if (!observation || observation.ignored) continue;
            const key = `${observation.pid}:${observation.startFingerprint}`;
            const existing = observedGateways.get(key);
            const firstSeenAt = performance.now();
            const firstSeenWall = new Date().toISOString();
            for (const [priorKey, prior] of observedGateways) {
              if (
                prior.pid === observation.pid &&
                priorKey !== key &&
                prior.exitedAtMonotonicMs === null
              ) {
                observedGateways.set(priorKey, {
                  ...prior,
                  exitedAtMonotonicMs: exitObservedAt,
                  exitedAt: exitObservedWall,
                });
              }
            }
            if (
              existing &&
              existing.listenerFingerprints.length > 0 &&
              observation.listenerFingerprints.length === 0
            ) {
              if (observation.endpoints.length !== 0) {
                throw new Error(
                  `inconsistent gateway listener closure for pid ${observation.pid}`,
                );
              }
              continue;
            }
            if (
              existing &&
              existing.exitedAtMonotonicMs !== null &&
              observation.listenerFingerprints.length > 0
            ) {
              throw new Error(
                `gateway listener resumed after exit for pid ${observation.pid}`,
              );
            }
            if (
              existing &&
              (
                (existing.listenerFingerprints.length > 0 &&
                  canonicalJson(existing.listenerFingerprints) !==
                    canonicalJson(observation.listenerFingerprints)) ||
                (existing.endpoints.length > 0 &&
                  canonicalJson(existing.endpoints) !==
                    canonicalJson(observation.endpoints))
              )
            ) {
              throw new Error(`gateway listener mutation for pid ${observation.pid}`);
            }
            if (!existing || existing.listenerFingerprints.length === 0) {
              const priorListeners = [
                ...attestation.process.listenerFingerprints,
                ...[...observedGateways.entries()]
                  .filter(([priorKey]) => priorKey !== key)
                  .map(([, entry]) => entry)
                  .flatMap((entry) => entry.listenerFingerprints),
              ];
              if (
                observation.listenerFingerprints.some((value) =>
                  priorListeners.includes(value))
              ) {
                throw new Error(
                  `gateway listener overlap for pid ${observation.pid}`,
                );
              }
            }
            observedGateways.set(key, {
              ...(existing || observation),
              verified: existing?.verified === true || observation.verified === true,
              endpoints:
                existing?.endpoints.length > 0
                  ? existing.endpoints
                  : observation.endpoints,
              socketFingerprint:
                existing?.listenerFingerprints.length > 0
                  ? existing.socketFingerprint
                  : observation.socketFingerprint,
              listenerFingerprints:
                existing?.listenerFingerprints.length > 0
                  ? existing.listenerFingerprints
                  : observation.listenerFingerprints,
              firstSeenMonotonicMs:
                existing?.firstSeenMonotonicMs ?? firstSeenAt,
              lastSeenMonotonicMs: firstSeenAt,
              exitedAtMonotonicMs: null,
              firstSeenAt: existing?.firstSeenAt ?? firstSeenWall,
              lastSeenAt: firstSeenWall,
              exitedAt: null,
              verificationSource:
                existing?.verificationSource === 'direct-environ'
                  ? 'direct-environ'
                  : observation.verificationSource,
            });
          } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    })().catch((error) => {
      monitorError = error;
      monitorActive = false;
      signalProcessGroup(child.pid, 'SIGTERM');
    });
    const sandboxExitCode = await waitForExit(child, 32 * 60_000);
    if (sandboxExitCode === null) {
      await terminateProcessGroup(child.pid);
      throw new Error('sandbox exceeded the launcher deadline');
    }
    await sandboxClosed;
    monitorActive = false;
    await monitorPromise;
    if (monitorError) throw monitorError;
    const exitRecords = capturedK6Log
      .split(/\r?\n/u)
      .flatMap((line) => line.startsWith(SANDBOX_EXIT_PREFIX)
        ? [JSON.parse(line.slice(SANDBOX_EXIT_PREFIX.length))]
        : []);
    if (exitRecords.length !== 1) {
      throw new Error('sandbox did not emit exactly one trusted exit record');
    }
    const [exitRecord] = exitRecords;
    if (
      exitRecord?.schema !== 'openclaw.k6.return-covenant-sandbox-exit.v1' ||
      !Number.isInteger(exitRecord?.k6ExitCode) ||
      !Number.isInteger(exitRecord?.driverExitCode)
    ) {
      throw new Error('sandbox exit record is invalid');
    }
    actualK6ExitCode = exitRecord.k6ExitCode;
    const driverExitCode = exitRecord.driverExitCode;
    const expectedSandboxExit = actualK6ExitCode || driverExitCode || 0;
    if (sandboxExitCode !== expectedSandboxExit) {
      throw new Error('sandbox process exit differs from trusted exit record');
    }
    const evidence = parseReturnCovenantEvidenceLog(capturedK6Log);
    evidence.k6ExitCode = actualK6ExitCode;
    const liveStoreObservation = liveStoreObservationPromise
      ? await liveStoreObservationPromise
      : null;
    const shutdownSettledAt = await waitForShutdownSettlement({
      processGroupId: child.pid,
      driverPid: ready.pid,
      gatewayPid: [...observedGateways.values()]
        .toSorted((left, right) =>
          right.lastSeenMonotonicMs - left.lastSeenMonotonicMs)[0]?.pid ??
        ready.gatewayPid,
    });
    const finalGateway = [...observedGateways.values()]
      .toSorted((left, right) =>
        right.lastSeenMonotonicMs - left.lastSeenMonotonicMs)[0] ?? {
        pid: ready.gatewayPid,
        startFingerprint: attestation.gateway.startFingerprint,
        socketFingerprint: attestation.gateway.socketFingerprint,
        endpoint: attestation.gateway.endpoint,
      };
    const finalStoreObservation =
      await inspectReturnCovenantDurableStores({
        plan,
        evidence,
        statePath,
        snapshotPath: path.join(retentionSnapshotsPath, 'final'),
        runtimeProcess: {
          processGroupId: child.pid,
          driver: {
            pid: ready.pid,
            startFingerprint:
              attestation.isolation.driverStartFingerprint,
          },
          gateway: {
            pid: finalGateway.pid,
            startFingerprint: finalGateway.startFingerprint,
            socketFingerprint: finalGateway.socketFingerprint,
            endpoint: finalGateway.endpoints?.[0] ?? finalGateway.endpoint,
          },
          shutdownSettledAt,
        },
        expectedRuntimeAlive: false,
      });
    const resolvedLiveStoreObservation = liveStoreObservation ?? {
        ...finalStoreObservation,
        status: 'unverified-resource-retention',
        failureReason:
          'docs-owned durable-store observation did not run while the isolated runtime was live',
        runtimeAlive: false,
        runtimeProcess: {
          ...finalStoreObservation.runtimeProcess,
          expectedAlive: true,
          expectedDriverStartFingerprint:
            attestation.isolation.driverStartFingerprint,
          expectedGatewayStartFingerprint:
            finalGateway.startFingerprint,
          before: null,
          after: null,
          matched: false,
        },
      };
    const stableStoreResources =
      resolvedLiveStoreObservation.status === 'observed' &&
      finalStoreObservation.status === 'observed' &&
      canonicalJson(resolvedLiveStoreObservation.resources) ===
        canonicalJson(finalStoreObservation.resources);
    const durableStoreObservation = {
      schema: 'openclaw.k6.return-covenant-durable-store-chain.v1',
      stable: stableStoreResources,
      live: resolvedLiveStoreObservation,
      final: finalStoreObservation,
    };
    const cleanupStartedAt = new Date().toISOString();
    let candidateCleanupClaims = null;
    let candidateCleanupStatus = 'read';
    try {
      candidateCleanupClaims = await readBoundedCandidateJson(
        candidateCleanupDraftPath,
        1_048_576,
      );
    } catch (error) {
      if (error?.code === 'ENOENT') {
        candidateCleanupStatus = 'missing';
      } else if (
        error instanceof SyntaxError ||
        /candidate JSON (?:is not|exceeded)/u.test(error?.message || '')
      ) {
        candidateCleanupStatus = 'invalid';
      } else {
        throw error;
      }
    }
    await writeExclusive(candidateCleanupDiagnosticPath, {
      schema: 'openclaw.k6.return-covenant-candidate-cleanup-diagnostic.v1',
      passEligible: false,
      status: candidateCleanupStatus,
      claims: candidateCleanupClaims,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const unexpectedGroupMembers = await processGroupMembers(child.pid);
    const finalGatewaySampleAt = performance.now();
    const finalGatewaySampleWall = new Date().toISOString();
    const gatewayLifecycle = [];
    const retainedGatewayPids = new Set();
    const knownGatewayPids = new Set();
    for (const observation of [...observedGateways.values()].toSorted(
      (left, right) =>
        left.firstSeenMonotonicMs - right.firstSeenMonotonicMs,
    )) {
      knownGatewayPids.add(observation.pid);
      const retainedAtCleanup =
        await processStartFingerprint(observation.pid) ===
        observation.startFingerprint;
      if (retainedAtCleanup) retainedGatewayPids.add(observation.pid);
      gatewayLifecycle.push({
        ...observation,
        exitedAtMonotonicMs: retainedAtCleanup
          ? null
          : observation.exitedAtMonotonicMs ?? finalGatewaySampleAt,
        exitedAt: retainedAtCleanup
          ? null
          : observation.exitedAt ?? finalGatewaySampleWall,
        retainedAtCleanup,
      });
    }
    const driverRetained =
      await processStartFingerprint(ready.pid) ===
      attestation.isolation.driverStartFingerprint;
    const retainedFixturePids = new Set(
      unexpectedGroupMembers.filter((pid) => !knownGatewayPids.has(pid)),
    );
    if (driverRetained) retainedFixturePids.add(ready.pid);
    if (unexpectedGroupMembers.length > 0) {
      signalProcessGroup(child.pid, 'SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const remainingGroupMembers = await processGroupMembers(child.pid);
    const closure = deriveReturnCovenantCaseHandleClosure({
      plan,
      evidence,
      driverAttestation: attestation,
    });
    const retention = deriveReturnCovenantTrustedRetention({
      plan,
      evidence,
      driverAttestation: attestation,
      gatewayLifecycle,
      durableStoreObservation,
    });
    const snapshotHead = (await execFileAsync('git', [
      '-C',
      snapshotPath,
      'rev-parse',
      'HEAD',
    ], { encoding: 'utf8' })).stdout.trim();
    const snapshotClean = (await execFileAsync('git', [
      '-C',
      snapshotPath,
      'status',
      '--porcelain=v1',
      '--untracked-files=no',
    ], { encoding: 'utf8' })).stdout.trim() === '';
    await rm(runRoot, { recursive: true, force: true });
    let runRootRemoved = false;
    try {
      await stat(runRoot);
    } catch (error) {
      if (error?.code === 'ENOENT') runRootRemoved = true;
      else throw error;
    }
    const unsignedCleanup = {
      schema: 'openclaw.k6.return-covenant-cleanup.v1',
      rowId: plan.rowId,
      runId: plan.runId,
      candidateSha: plan.target.candidateSha,
      runtimeBuildSha: plan.target.runtimeBuildSha,
      docsHarnessSha: plan.target.docsHarnessSha,
      runtimeConfigSha256: plan.target.runtimeConfigSha256,
      startedAt: cleanupStartedAt,
      endedAt: new Date().toISOString(),
      retained: {
        ...retention.retained,
        gateways: retainedGatewayPids.size,
        fixtureProcesses: retainedFixturePids.size,
      },
      retentionAuthority: RETURN_COVENANT_RETENTION_AUTHORITY,
      resourceObservation: retention.resourceObservation,
      durableStoreObservation,
      allCaseHandlesClosed: closure.allCaseHandlesClosed,
      caseHandles: closure.caseHandles,
      observationSetSha256: sha256(canonicalJson(evidence.observations)),
      phaseChainSha256: sha256(canonicalJson(evidence.phaseChains)),
      driverAttestationSha256: attestation.attestationSha256,
      runCleanupReceiptId: evidence.cleanupRun?.receiptId ?? null,
      gatewayLifecycle,
      fixtureProcessStopped: retainedFixturePids.size === 0,
      gatewayProcessStopped: retainedGatewayPids.size === 0,
      homeRemoved: runRootRemoved,
      stateRemoved: runRootRemoved,
      configRemoved: runRootRemoved,
      snapshotMatchedCandidateAfterRun:
        snapshotHead === plan.target.candidateSha && snapshotClean,
      runRootRemoved,
      driverExitCode,
      processGroupEmpty: remainingGroupMembers.length === 0,
      unexpectedProcessGroupMembers: unexpectedGroupMembers.length,
      isolationFingerprint: attestation.isolation.runRootFingerprint,
      k6: {
        version: pinnedK6.version,
        sha256: pinnedK6.sha256,
        pathFingerprint: pinnedK6.sourcePathFingerprint,
      },
    };
    const cleanup = {
      ...unsignedCleanup,
      launcherIntegrity: {
        algorithm: 'hmac-sha256-launch-key-v1',
        signature: createHmac('sha256', observerSigningKey)
          .update(canonicalJson(unsignedCleanup))
          .digest('hex'),
      },
    };
    await writeExclusive(cleanupPath, cleanup);
    await Promise.all([
      writeFile(driverLogPath, capturedDriverLog, {
        mode: 0o600,
        flag: 'wx',
      }),
      writeFile(k6LogPath, capturedK6Log, { mode: 0o600, flag: 'wx' }),
      writeFile(k6ExitCodePath, `${actualK6ExitCode}\n`, {
        mode: 0o600,
        flag: 'wx',
      }),
    ]);
    await assertDocsIdentity(docsDir, plan.target.docsHarnessSha);
    const directCleanup = await verifyReturnCovenantDirectCleanup(attestation);
    const receipt = resolveReturnCovenantAuthoritativeReceipt({
      plan,
      evidence,
      cleanup,
      runtimeConfig,
      driverAttestation: attestation,
      directCleanup,
      signingKey: observerSigningKey,
    });
    const validation = validateReturnCovenantAuthoritativeReceipt(
      receipt,
      observerSigningKey,
    );
    if (!validation.valid) {
      throw new Error(`generated observer receipt is invalid: ${validation.reason}`);
    }
    await writeExclusive(
      path.join(artifactDir, 'observer-receipt.json'),
      receipt,
    );
    completed = true;
    if (receipt.verdict !== 'PASS-candidate') {
      throw new Error(`return covenant observer verdict: ${receipt.verdict}`);
    }
  } finally {
    monitorActive = false;
    if (monitorPromise) {
      await Promise.race([
        monitorPromise,
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    }
    process.removeListener('SIGINT', handleTermination);
    process.removeListener('SIGTERM', handleTermination);
    if (pinnedK6?.handle) await pinnedK6.handle.close();
    if (child) {
      await terminateProcessGroup(child.pid);
      if (child.exitCode === null) await waitForExit(child, 2_000);
    }
    if (!completed) {
      await Promise.all([
        capturedDriverLog
          ? writeFile(driverLogPath, capturedDriverLog, {
            mode: 0o600,
            flag: 'wx',
          }).catch((error) => {
            if (error?.code !== 'EEXIST') throw error;
          })
          : Promise.resolve(),
        capturedK6Log
          ? writeFile(k6LogPath, capturedK6Log, {
            mode: 0o600,
            flag: 'wx',
          }).catch((error) => {
            if (error?.code !== 'EEXIST') throw error;
          })
          : Promise.resolve(),
      ]);
    }
    if (!completed) {
      await rm(runRoot, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  process.stderr.write(`return covenant trusted launcher failed: ${error.message}\n`);
  process.exitCode = 1;
});
