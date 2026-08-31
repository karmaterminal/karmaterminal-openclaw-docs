#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from '../lib/canonical-json.mjs';
import {
  childTerminationReason,
  readBoundedCandidateJson,
} from '../lib/return-covenant-candidate-io.mjs';
import {
  fingerprintProcessLoopbackListeners,
  inspectProcessLoopbackListeners,
} from '../lib/return-covenant-driver-attestation.mjs';
import {
  findReturnCovenantObservedCommand,
  startReturnCovenantTrackedCommandObserver,
} from '../lib/return-covenant-process-observer.mjs';
import {
  materializeReturnCovenantRuntimeArtifact,
  removeReturnCovenantRuntimeArtifact,
  verifyReturnCovenantTrackedCommand,
} from '../lib/return-covenant-runtime-artifact.mjs';
import {
  RETURN_COVENANT_RUNTIME_MOUNT_OBSERVATION_SCHEMA,
  validateReturnCovenantRuntimeMountObservation,
} from '../lib/return-covenant-runtime-artifact-contract.mjs';
import {
  validateReturnCovenantPlan,
} from '../lib/return-covenant-scenario-contract.mjs';

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(scriptDir, '../../..');
const SMOKE_SCHEMA =
  'openclaw.k6.return-covenant-runtime-artifact-smoke.v1';
const DOCS_SMOKE_FILES = [
  'tools/k6-proofs/lib/canonical-json.mjs',
  'tools/k6-proofs/lib/return-covenant-candidate-io.mjs',
  'tools/k6-proofs/lib/return-covenant-driver-attestation.mjs',
  'tools/k6-proofs/lib/return-covenant-process-observer.mjs',
  'tools/k6-proofs/lib/return-covenant-runtime-artifact-contract.mjs',
  'tools/k6-proofs/lib/return-covenant-runtime-artifact.mjs',
  'tools/k6-proofs/lib/return-covenant-scenario-contract.mjs',
  'tools/k6-proofs/scripts/smoke-return-covenant-runtime-artifact.mjs',
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function pathWithin(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function parsePairs(argv, start, allowed, required) {
  const values = {};
  for (let index = start; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error('runtime smoke arguments must be flag/value pairs');
    }
    const name = flag.slice(2);
    if (!allowed.has(name)) throw new Error(`unknown argument: ${flag}`);
    values[name] = value;
  }
  for (const name of required) {
    if (!values[name]) throw new Error(`--${name} is required`);
  }
  return values;
}

function parseOuterArgs(argv) {
  const names = [
    'plan',
    'source-dir',
    'runtime-config',
    'runtime-artifact',
    'receipt',
  ];
  return parsePairs(argv, 2, new Set(names), names);
}

function parseInnerArgs(argv) {
  const names = [
    'gateway',
    'gateway-args',
    'ready',
    'stop',
  ];
  return parsePairs(argv, 3, new Set(names), names);
}

async function git(directory, args) {
  const { stdout } = await execFileAsync('git', ['-C', directory, ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_DIR: undefined,
      GIT_WORK_TREE: undefined,
      GIT_INDEX_FILE: undefined,
      GIT_OBJECT_DIRECTORY: undefined,
      GIT_ALTERNATE_OBJECT_DIRECTORIES: undefined,
      GIT_NO_REPLACE_OBJECTS: '1',
    },
  });
  return stdout.trim();
}

async function writeExclusive(file, value, mode = 0o600) {
  const handle = await open(file, 'wx', mode);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
  } finally {
    await handle.close();
  }
}

async function waitForExit(child, timeoutMs) {
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

async function stopChild(child) {
  if (!child || childTerminationReason(child)) return;
  child.kill('SIGTERM');
  if (await waitForExit(child, 5_000) === null) {
    child.kill('SIGKILL');
    await waitForExit(child, 2_000);
  }
}

function signalProcessGroup(processGroupId, signal) {
  try {
    process.kill(-processGroupId, signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
}

async function stopProcessGroup(processGroupId) {
  if (!Number.isInteger(processGroupId) || processGroupId < 2) return;
  signalProcessGroup(processGroupId, 'SIGTERM');
  const deadline = Date.now() + 5_000;
  while ((await processGroupMembers(processGroupId)).length > 0) {
    if (Date.now() >= deadline) {
      signalProcessGroup(processGroupId, 'SIGKILL');
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
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

async function namespacePid(pid) {
  const status = await readFile(`/proc/${pid}/status`, 'utf8');
  return Number(
    status.match(/^NSpid:\s+(.+)$/mu)?.[1]
      ?.trim()
      .split(/\s+/u)
      .at(-1) || pid,
  );
}

async function sandboxDescendants(rootPid) {
  const descendants = [];
  const pending = [rootPid];
  const seen = new Set();
  while (pending.length > 0) {
    const pid = pending.shift();
    if (!Number.isInteger(pid) || seen.has(pid)) continue;
    seen.add(pid);
    descendants.push(pid);
    try {
      const children = (await readFile(
        `/proc/${pid}/task/${pid}/children`,
        'utf8',
      )).trim().split(/\s+/u).filter(Boolean).map(Number);
      pending.push(...children);
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ESRCH') throw error;
    }
  }
  return descendants;
}

async function processIdentity(pid) {
  const [
    commandLineBytes,
    cwdLink,
    executableLink,
    environmentBytes,
    rawStat,
    listeners,
    namespaceProcessId,
  ] = await Promise.all([
    readFile(`/proc/${pid}/cmdline`),
    readlink(`/proc/${pid}/cwd`),
    readlink(`/proc/${pid}/exe`),
    readFile(`/proc/${pid}/environ`),
    readFile(`/proc/${pid}/stat`, 'utf8'),
    inspectProcessLoopbackListeners(pid),
    namespacePid(pid),
  ]);
  const fields = rawStat.slice(rawStat.lastIndexOf(')') + 2)
    .trim()
    .split(/\s+/u);
  const startTicks = fields[19];
  if (!startTicks) throw new Error(`missing process start ticks for ${pid}`);
  return {
    pid,
    namespacePid: namespaceProcessId,
    commandLine: commandLineBytes.toString('utf8').split('\0').filter(Boolean),
    cwd: await realpath(cwdLink),
    executablePath: await realpath(executableLink),
    environment: Object.fromEntries(
      environmentBytes.toString('utf8').split('\0').flatMap((entry) => {
        const separator = entry.indexOf('=');
        return separator > 0
          ? [[entry.slice(0, separator), entry.slice(separator + 1)]]
          : [];
      }),
    ),
    startFingerprint: sha256(`${pid}:${startTicks}`),
    namespaceStartFingerprint: sha256(`${namespaceProcessId}:${startTicks}`),
    listeners,
  };
}

async function findAttestedGateway({
  sandboxPid,
  ready,
  gatewayPath,
  gatewayArgs,
  snapshotPath,
  homePath,
  statePath,
  configPath,
  artifactManifestSha256,
  productTreeSha,
  gatewayTokenFingerprint,
  commandObservations,
}) {
  const expectedNode = await realpath(process.execPath);
  let lastCandidates = [];
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidates = [];
    for (const pid of await sandboxDescendants(sandboxPid)) {
      if (pid === sandboxPid) continue;
      try {
        const identity = await processIdentity(pid);
        const launchObservation = findReturnCovenantObservedCommand(
          commandObservations,
          {
            role: 'gateway',
            pid,
            startFingerprint: identity.startFingerprint,
          },
        );
        candidates.push({
          pid,
          namespacePid: identity.namespacePid,
          commandLine: identity.commandLine.slice(0, 4),
          launchObserved: launchObservation !== null,
          listeners: identity.listeners,
        });
        if (
          identity.namespacePid === ready.gatewayPid &&
          identity.executablePath === expectedNode &&
          identity.cwd === snapshotPath &&
          launchObservation?.commandLine?.[1] === gatewayPath &&
          canonicalJson(launchObservation.commandLine.slice(2)) ===
            canonicalJson(gatewayArgs) &&
          (
            canonicalJson(identity.commandLine) ===
              canonicalJson(launchObservation.commandLine) ||
            canonicalJson(identity.commandLine) ===
              canonicalJson(['openclaw-gateway'])
          ) &&
          identity.environment.HOME === homePath &&
          identity.environment.OPENCLAW_STATE_DIR === statePath &&
          identity.environment.OPENCLAW_CONFIG_PATH === configPath &&
          identity.environment.OPENCLAW_PRODUCT_TREE_SHA === productTreeSha &&
          identity.environment
            .OPENCLAW_RETURN_COVENANT_RUNTIME_ARTIFACT_SHA256 ===
            artifactManifestSha256 &&
          sha256(identity.environment.OPENCLAW_GATEWAY_TOKEN || '') ===
            gatewayTokenFingerprint &&
          identity.namespaceStartFingerprint ===
            ready.gatewayStartFingerprint &&
          canonicalJson(identity.listeners) ===
            canonicalJson(ready.listeners)
        ) {
          return {
            ...identity,
            launchObservation,
          };
        }
      } catch (error) {
        if (
          error?.code !== 'ENOENT' &&
          error?.code !== 'EACCES' &&
          error?.code !== 'ESRCH'
        ) throw error;
      }
    }
    lastCandidates = candidates;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    `could not bind real gateway child to its tracked command: ${JSON.stringify(lastCandidates)}`,
  );
}

async function assertDocsIdentity(expectedSha) {
  const [head, status] = await Promise.all([
    git(docsDir, ['rev-parse', 'HEAD']),
    git(docsDir, [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
      '--',
      ...DOCS_SMOKE_FILES,
    ]),
  ]);
  if (head !== expectedSha || status !== '') {
    throw new Error('runtime smoke docs authority differs from the frozen plan');
  }
  for (const relativePath of DOCS_SMOKE_FILES) {
    const file = path.join(docsDir, relativePath);
    const [info, resolved, treeEntry, workingBlob] = await Promise.all([
      lstat(file),
      realpath(file),
      git(docsDir, ['ls-tree', expectedSha, '--', relativePath]),
      git(docsDir, ['hash-object', '--', relativePath]),
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
      throw new Error(`runtime smoke docs file is not frozen: ${relativePath}`);
    }
  }
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

async function prepareMountPoints(snapshotPath, mounts) {
  const result = [];
  for (const mount of mounts) {
    const destination = path.resolve(snapshotPath, mount.candidatePath);
    if (!pathWithin(destination, snapshotPath)) {
      throw new Error('runtime smoke mount escapes the candidate snapshot');
    }
    try {
      await lstat(destination);
      throw new Error(
        `runtime smoke would shadow candidate bytes: ${mount.candidatePath}`,
      );
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    await mkdir(destination, { mode: 0o555 });
    result.push({ ...mount, destination });
  }
  return result;
}

async function waitForReady(file, child, capturedError, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const termination = childTerminationReason(child);
    if (termination) {
      throw new Error(
        `runtime smoke sandbox exited before ready (${termination}): ${capturedError()}`,
      );
    }
    try {
      return await readBoundedCandidateJson(file, 131_072);
    } catch (error) {
      if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`runtime smoke timed out: ${capturedError()}`);
}

async function firstRegularFile(directory) {
  for (const entry of (await readdir(directory)).toSorted()) {
    const file = path.join(directory, entry);
    const info = await lstat(file);
    if (info.isSymbolicLink()) {
      throw new Error(`runtime smoke mount contains a symlink: ${file}`);
    }
    if (info.isFile()) return file;
    if (info.isDirectory()) {
      const nested = await firstRegularFile(file);
      if (nested) return nested;
      continue;
    }
    throw new Error(`runtime smoke mount contains a special file: ${file}`);
  }
  return null;
}

async function requireInnerChmodErofs(target, mode, label) {
  const originalMode = (await lstat(target)).mode & 0o777;
  try {
    await chmod(target, mode);
  } catch (error) {
    if (error?.code === 'EROFS') return 'EROFS';
    throw new Error(
      `${label} chmod failed with ${error?.code || error?.message}, expected EROFS`,
    );
  }
  await chmod(target, originalMode);
  throw new Error(`${label} chmod unexpectedly succeeded`);
}

async function assertInnerMountReadOnly(candidatePath, label) {
  const info = await lstat(candidatePath);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`runtime smoke mount is not a real directory: ${candidatePath}`);
  }
  const file = await firstRegularFile(candidatePath);
  if (!file) throw new Error(`runtime smoke mount is empty: ${candidatePath}`);
  const directoryChmodErrno = await requireInnerChmodErofs(
    candidatePath,
    0o755,
    `${label} directory`,
  );
  const fileChmodErrno = await requireInnerChmodErofs(
    file,
    0o644,
    `${label} file`,
  );
  const probe = path.join(candidatePath, '.return-covenant-write-probe');
  try {
    await writeFile(probe, 'must not write\n', { flag: 'wx' });
    await rm(probe, { force: true });
    throw new Error(`runtime smoke mount is writable: ${candidatePath}`);
  } catch (error) {
    if (error?.code !== 'EROFS') throw error;
    return {
      candidatePath: label,
      directoryChmodErrno,
      fileChmodErrno,
      createErrno: 'EROFS',
    };
  }
}

async function innerMain() {
  const input = parseInnerArgs(process.argv);
  let gatewayArgs;
  try {
    gatewayArgs = JSON.parse(input['gateway-args']);
  } catch (error) {
    throw new Error(`--gateway-args is invalid JSON: ${error.message}`);
  }
  if (!Array.isArray(gatewayArgs)) {
    throw new Error('--gateway-args must decode to an array');
  }
  const runtimeMountObservation = {
    schema: RETURN_COVENANT_RUNTIME_MOUNT_OBSERVATION_SCHEMA,
    source: 'trusted-sandbox-supervisor',
    manifestSha256:
      process.env.OPENCLAW_RETURN_COVENANT_RUNTIME_ARTIFACT_SHA256,
    mounts: await Promise.all([
      assertInnerMountReadOnly(
        path.join(process.cwd(), 'node_modules'),
        'node_modules',
      ),
      assertInnerMountReadOnly(path.join(process.cwd(), 'dist'), 'dist'),
    ]),
  };
  let child;
  let stdout = '';
  let stderr = '';
  try {
    child = spawn(process.execPath, [input.gateway, ...gatewayArgs], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-1_000_000);
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-1_000_000);
    });
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    let listeners = [];
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const termination = childTerminationReason(child);
      if (termination) {
        throw new Error(
          `tracked gateway exited before listening (${termination}); stdout=${stdout}; stderr=${stderr}`,
        );
      }
      listeners = await inspectProcessLoopbackListeners(child.pid);
      if (listeners.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (listeners.length === 0) {
      throw new Error(`tracked gateway did not listen; stdout=${stdout}; stderr=${stderr}`);
    }
    const rawStat = await readFile(`/proc/${child.pid}/stat`, 'utf8');
    const fields = rawStat.slice(rawStat.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/u);
    await writeExclusive(input.ready, {
      schema: SMOKE_SCHEMA,
      status: 'ready',
      gatewayPid: child.pid,
      gatewayStartFingerprint: sha256(`${child.pid}:${fields[19]}`),
      listeners,
      listenerSetSha256: fingerprintProcessLoopbackListeners(listeners),
      runtimeMountObservation,
      runtimeArtifactManifestSha256:
        process.env.OPENCLAW_RETURN_COVENANT_RUNTIME_ARTIFACT_SHA256,
    });
    while (true) {
      const termination = childTerminationReason(child);
      if (termination) {
        throw new Error(
          `tracked gateway exited before stop authority (${termination}); stdout=${stdout}; stderr=${stderr}`,
        );
      }
      try {
        await stat(input.stop);
        break;
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    await stopChild(child);
    process.stdout.write(`${JSON.stringify({
      schema: SMOKE_SCHEMA,
      status: 'stopped',
      gatewayExitCode: child.exitCode,
      gatewaySignal: child.signalCode,
    })}\n`);
  } finally {
    await stopChild(child);
  }
}

async function outerMain() {
  const args = parseOuterArgs(process.argv);
  const [sourceDir, artifactSource] = await Promise.all([
    realpath(args['source-dir']),
    realpath(args['runtime-artifact']),
  ]);
  const artifactInputInfo = await lstat(path.resolve(args['runtime-artifact']));
  if (
    !artifactInputInfo.isDirectory() ||
    artifactInputInfo.isSymbolicLink()
  ) {
    throw new Error('--runtime-artifact must be a real directory');
  }
  const [plan, runtimeConfig] = await Promise.all([
    readFile(args.plan, 'utf8').then(JSON.parse),
    readFile(args['runtime-config'], 'utf8').then(JSON.parse),
  ]);
  const planErrors = validateReturnCovenantPlan(plan);
  if (planErrors.length > 0) {
    throw new Error(`invalid return covenant smoke plan: ${planErrors.join('; ')}`);
  }
  if (
    sha256(canonicalJson(runtimeConfig)) !==
      plan.target.runtimeConfigSha256
  ) {
    throw new Error('runtime smoke config differs from the frozen plan');
  }
  await assertDocsIdentity(plan.target.docsHarnessSha);
  const receiptPath = path.resolve(args.receipt);
  const receiptParent = await realpath(path.dirname(receiptPath));
  if (
    pathWithin(receiptPath, docsDir) ||
    pathWithin(receiptPath, sourceDir) ||
    pathWithin(receiptPath, artifactSource)
  ) {
    throw new Error('runtime smoke receipt must be outside authority inputs');
  }
  try {
    await lstat(receiptPath);
    throw new Error('runtime smoke receipt path must not already exist');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const runRoot = await mkdtemp(
    path.join(tmpdir(), 'return-covenant-runtime-smoke-'),
  );
  await chmod(runRoot, 0o700);
  const snapshotPath = path.join(runRoot, 'snapshot');
  const homePath = path.join(runRoot, 'home');
  const statePath = path.join(runRoot, 'state');
  const configDir = path.join(runRoot, 'config');
  const ipcPath = path.join(runRoot, 'ipc');
  const runtimeArtifactPath = path.join(runRoot, 'runtime-artifact');
  const configPath = path.join(configDir, 'openclaw.json');
  const readyPath = path.join(ipcPath, 'ready.json');
  const stopPath = path.join(ipcPath, 'stop');
  let sandbox;
  let runtimeArtifact;
  let gatewayIdentity;
  let capturedStdout = '';
  let capturedStderr = '';
  let runRootRemoved = false;
  let sandboxStartFingerprint = null;
  let commandObserver = null;
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
      mkdir(configDir, { mode: 0o700 }),
      mkdir(ipcPath, { mode: 0o700 }),
    ]);
    await writeFile(
      configPath,
      `${JSON.stringify(runtimeConfig, null, 2)}\n`,
      { mode: 0o600, flag: 'wx' },
    );
    runtimeArtifact = await materializeReturnCovenantRuntimeArtifact({
      artifactDir: artifactSource,
      destinationDir: runtimeArtifactPath,
      sourceDir: snapshotPath,
      expected: {
        rowId: plan.rowId,
        runId: plan.runId,
        productSha: plan.target.candidateSha,
        productTreeSha: plan.target.productTreeSha,
        docsHarnessSha: plan.target.docsHarnessSha,
        manifestSha256: plan.target.runtimeArtifactManifestSha256,
      },
    });
    const mounts = await prepareMountPoints(
      snapshotPath,
      runtimeArtifact.mounts,
    );
    const command = await verifyReturnCovenantTrackedCommand({
      sourceDir: snapshotPath,
      relativePath: plan.driver.gatewayCommand.relativePath,
      productSha: plan.target.candidateSha,
      expectedSha256: plan.driver.gatewayCommand.sha256,
    });
    const gatewayToken = randomBytes(32).toString('hex');
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
        configDir,
        ipcPath,
        runtimeArtifactPath,
      ]),
      '--ro-bind', process.execPath, process.execPath,
      '--ro-bind', docsDir, docsDir,
      '--ro-bind', configDir, configDir,
      '--ro-bind', snapshotPath, snapshotPath,
      '--bind', homePath, homePath,
      '--bind', statePath, statePath,
      '--bind', ipcPath, ipcPath,
      ...mounts.flatMap((mount) => [
        '--ro-bind',
        mount.source,
        mount.destination,
      ]),
      '--chdir', snapshotPath,
      '--clearenv',
      '--setenv', 'PATH', path.dirname(process.execPath),
      '--setenv', 'LANG', process.env.LANG || 'C.UTF-8',
      '--setenv', 'HOME', homePath,
      '--setenv', 'OPENCLAW_STATE_DIR', statePath,
      '--setenv', 'OPENCLAW_CONFIG_PATH', configPath,
      '--setenv', 'OPENCLAW_GATEWAY_TOKEN', gatewayToken,
      '--setenv', 'OPENCLAW_CANDIDATE_SHA', plan.target.candidateSha,
      '--setenv', 'OPENCLAW_PRODUCT_TREE_SHA', plan.target.productTreeSha,
      '--setenv', 'OPENCLAW_PROOFS_DOCS_REF', plan.target.docsHarnessSha,
      '--setenv', 'OPENCLAW_RETURN_COVENANT_RUNTIME_ARTIFACT_SHA256',
      runtimeArtifact.binding.manifestSha256,
      process.execPath,
      fileURLToPath(import.meta.url),
      '--inside',
      '--gateway', command.path,
      '--gateway-args', JSON.stringify(plan.driver.gatewayCommand.args),
      '--ready', readyPath,
      '--stop', stopPath,
    ];
    sandbox = spawn(bwrapPath, bwrapArgs, {
      cwd: snapshotPath,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH || '' },
    });
    commandObserver = startReturnCovenantTrackedCommandObserver({
      rootPid: sandbox.pid,
      commands: [{
        role: 'gateway',
        scriptPath: command.path,
        args: plan.driver.gatewayCommand.args,
        cwd: snapshotPath,
      }],
    });
    sandbox.stdout.setEncoding('utf8');
    sandbox.stderr.setEncoding('utf8');
    sandbox.stdout.on('data', (chunk) => {
      capturedStdout = `${capturedStdout}${chunk}`.slice(-2_000_000);
    });
    sandbox.stderr.on('data', (chunk) => {
      capturedStderr = `${capturedStderr}${chunk}`.slice(-2_000_000);
    });
    await new Promise((resolve, reject) => {
      sandbox.once('spawn', resolve);
      sandbox.once('error', reject);
    });
    sandboxStartFingerprint = await processStartFingerprint(sandbox.pid);
    const ready = await waitForReady(
      readyPath,
      sandbox,
      () => capturedStderr,
    );
    if (
      ready?.schema !== SMOKE_SCHEMA ||
      ready?.status !== 'ready' ||
      !Number.isInteger(ready?.gatewayPid) ||
      !Array.isArray(ready?.listeners) ||
      ready.listeners.length < 1 ||
      !validateReturnCovenantRuntimeMountObservation(
        ready?.runtimeMountObservation,
        runtimeArtifact.binding,
      ) ||
      ready?.runtimeArtifactManifestSha256 !==
        runtimeArtifact.binding.manifestSha256 ||
      ready?.listenerSetSha256 !==
        fingerprintProcessLoopbackListeners(ready.listeners)
    ) {
      throw new Error('runtime smoke inner ready receipt is invalid');
    }
    gatewayIdentity = await findAttestedGateway({
      sandboxPid: sandbox.pid,
      ready,
      gatewayPath: command.path,
      gatewayArgs: plan.driver.gatewayCommand.args,
      snapshotPath,
      homePath,
      statePath,
      configPath,
      artifactManifestSha256: runtimeArtifact.binding.manifestSha256,
      productTreeSha: plan.target.productTreeSha,
      gatewayTokenFingerprint: sha256(gatewayToken),
      commandObservations: commandObserver.observations,
    });
    await commandObserver.stop();
    if (commandObserver.error) throw commandObserver.error;
    await writeFile(stopPath, 'stop\n', { mode: 0o600, flag: 'wx' });
    const sandboxExitCode = await waitForExit(sandbox, 15_000);
    if (sandboxExitCode === null) {
      throw new Error('runtime smoke sandbox did not stop');
    }
    if (sandboxExitCode !== 0) {
      throw new Error(
        `runtime smoke sandbox failed with ${sandboxExitCode}: stdout=${capturedStdout}; stderr=${capturedStderr}`,
      );
    }
    if (
      await processStartFingerprint(gatewayIdentity.pid) ===
        gatewayIdentity.startFingerprint
    ) {
      throw new Error('runtime smoke gateway remained alive after stop');
    }
    await removeReturnCovenantRuntimeArtifact(runtimeArtifactPath);
    await rm(runRoot, { recursive: true, force: true });
    try {
      await stat(runRoot);
    } catch (error) {
      if (error?.code === 'ENOENT') runRootRemoved = true;
      else throw error;
    }
    if (!runRootRemoved) throw new Error('runtime smoke run root remained');
    const unsignedReceipt = {
      schema: SMOKE_SCHEMA,
      verdict: 'PASS',
      runId: plan.runId,
      rowId: plan.rowId,
      candidateSha: plan.target.candidateSha,
      productTreeSha: plan.target.productTreeSha,
      docsHarnessSha: plan.target.docsHarnessSha,
      runtimeConfigSha256: plan.target.runtimeConfigSha256,
      runtimeArtifact: runtimeArtifact.binding,
      gatewayCommand: {
        relativePath: plan.driver.gatewayCommand.relativePath,
        sha256: command.sha256,
        gitBlob: command.gitBlob,
        args: plan.driver.gatewayCommand.args,
        trackedAtCandidate: true,
      },
      process: {
        sandboxPidFingerprint: sha256(String(sandbox.pid)),
        sandboxStartFingerprint,
        gatewayPidFingerprint: sha256(String(gatewayIdentity.pid)),
        gatewayStartFingerprint: gatewayIdentity.startFingerprint,
        namespaceGatewayPid: gatewayIdentity.namespacePid,
        namespaceGatewayStartFingerprint:
          gatewayIdentity.namespaceStartFingerprint,
        commandLineSha256:
          gatewayIdentity.launchObservation.commandLineSha256,
        currentProcessTitleFingerprint: sha256(
          gatewayIdentity.commandLine.join('\0'),
        ),
        commandObservationSource:
          gatewayIdentity.launchObservation.source,
        listenerSetSha256: fingerprintProcessLoopbackListeners(
          gatewayIdentity.listeners,
        ),
        distinctGatewayChild: gatewayIdentity.pid !== sandbox.pid,
      },
      isolation: {
        privateRunRoot: true,
        isolatedHome: true,
        isolatedState: true,
        isolatedConfig: true,
        isolatedNetwork: true,
        isolatedPid: true,
        isolatedIpc: true,
        nodePathAbsent:
          gatewayIdentity.environment.NODE_PATH === undefined,
        mounts: runtimeArtifact.binding.mounts,
        runtimeMountObservation: ready.runtimeMountObservation,
      },
      cleanup: {
        gatewayStopped: true,
        sandboxStopped: true,
        runtimeArtifactRemoved: true,
        runRootRemoved,
      },
    };
    await writeExclusive(receiptPath, {
      ...unsignedReceipt,
      receiptSha256: sha256(canonicalJson(unsignedReceipt)),
    });
    process.stdout.write(`${JSON.stringify({
      status: 'PASS',
      receipt: path.relative(receiptParent, receiptPath),
      candidateSha: plan.target.candidateSha,
      runtimeArtifactManifestSha256:
        runtimeArtifact.binding.manifestSha256,
      gatewayStartFingerprint: gatewayIdentity.startFingerprint,
    })}\n`);
  } catch (error) {
    let cleanupError = null;
    try {
      if (commandObserver) await commandObserver.stop();
      if (sandbox) await stopProcessGroup(sandbox.pid);
      if (runtimeArtifact) {
        await removeReturnCovenantRuntimeArtifact(runtimeArtifactPath);
      }
      await rm(runRoot, { recursive: true, force: true });
    } catch (caughtCleanupError) {
      cleanupError = caughtCleanupError;
    }
    if (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `${error.message}; runtime smoke cleanup also failed: ${cleanupError.message}`,
      );
    }
    throw error;
  }
}

const inside = process.argv[2] === '--inside';
(inside ? innerMain() : outerMain()).catch((error) => {
  process.stderr.write(`return covenant runtime smoke failed: ${error.message}\n`);
  process.exitCode = 1;
});
