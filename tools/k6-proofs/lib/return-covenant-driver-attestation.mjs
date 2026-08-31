import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstat,
  readFile,
  readdir,
  readlink,
  realpath,
} from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  RETURN_COVENANT_DRIVER_ATTESTATION_SCHEMA,
  RETURN_COVENANT_DRIVER_SCHEMA,
  validateReturnCovenantDriverAttestation,
  validateReturnCovenantPlan,
} from './return-covenant-scenario-contract.mjs';
import {
  validateReturnCovenantRuntimeArtifactBinding,
} from './return-covenant-runtime-artifact-contract.mjs';
import { canonicalJson } from './signed-observer-receipt.mjs';

export const RETURN_COVENANT_DRIVER_READY_SCHEMA =
  'openclaw.k6.return-covenant-driver-ready.v1';

const execFileAsync = promisify(execFile);
const LOOPBACK_URL = /^http:\/\/127\.0\.0\.1(?::[0-9]+)?$/u;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function git(directory, args) {
  const { stdout } = await execFileAsync('git', ['-C', directory, ...args], {
    encoding: 'utf8',
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

function safeRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0 || path.isAbsolute(value)) {
    return false;
  }
  const normalized = path.posix.normalize(value.replaceAll(path.sep, '/'));
  return normalized === value && normalized !== '..' && !normalized.startsWith('../');
}

function pathWithin(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function exactNodeCommand(process, scriptPath, interpreterPath, expectedArgs) {
  return process.executablePath === interpreterPath &&
    process.commandLine[1] === scriptPath &&
    canonicalJson(process.commandLine.slice(2)) === canonicalJson(expectedArgs) &&
    process.environment.NODE_OPTIONS === undefined;
}

async function processIdentity(pid) {
  const processRoot = `/proc/${pid}`;
  const [
    commandLineBytes,
    processCwd,
    processStat,
    executablePath,
    environmentBytes,
    processStatus,
  ] = await Promise.all([
    readFile(path.join(processRoot, 'cmdline')),
    readlink(path.join(processRoot, 'cwd')).then((value) => realpath(value)),
    readFile(path.join(processRoot, 'stat'), 'utf8'),
    readlink(path.join(processRoot, 'exe')).then((value) => realpath(value)),
    readFile(path.join(processRoot, 'environ')),
    readFile(path.join(processRoot, 'status'), 'utf8'),
  ]);
  const commandLine = commandLineBytes
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  const processFields = processStat
    .slice(processStat.lastIndexOf(')') + 2)
    .trim()
    .split(/\s+/u);
  const processStartTicks = processFields[19];
  const namespacePid = Number(
    processStatus.match(/^NSpid:\s+(.+)$/mu)?.[1]
      ?.trim()
      .split(/\s+/u)
      .at(-1) || pid,
  );
  if (!processStartTicks) {
    throw new Error('could not read process start identity');
  }
  return {
    commandLine,
    cwd: processCwd,
    executablePath,
    environment: Object.fromEntries(
      environmentBytes.toString('utf8').split('\0').flatMap((entry) => {
        const separator = entry.indexOf('=');
        return separator > 0 ? [[entry.slice(0, separator), entry.slice(separator + 1)]] : [];
      }),
    ),
    processGroupId: Number(processFields[2]),
    startFingerprint: sha256(`${pid}:${processStartTicks}`),
    namespacePid,
    namespaceStartFingerprint: sha256(`${namespacePid}:${processStartTicks}`),
  };
}

async function currentProcessStartFingerprint(pid) {
  try {
    const raw = await readFile(`/proc/${pid}/stat`, 'utf8');
    const processFields = raw
      .slice(raw.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/u);
    return processFields[19] ? sha256(`${pid}:${processFields[19]}`) : null;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function processConfigPath(process) {
  const value = process.environment.OPENCLAW_CONFIG_PATH;
  if (!path.isAbsolute(value || '')) {
    throw new Error('isolated gateway does not expose one OPENCLAW_CONFIG_PATH');
  }
  const info = await lstat(value);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error('isolated gateway config must be a regular non-symlink file');
  }
  return realpath(value);
}

async function isDescendantOrSelf(pid, ancestorPid) {
  let current = pid;
  const visited = new Set();
  while (current > 1 && !visited.has(current)) {
    if (current === ancestorPid) return true;
    visited.add(current);
    const status = await readFile(`/proc/${current}/status`, 'utf8');
    const parent = Number(status.match(/^PPid:\s+([0-9]+)$/mu)?.[1] || 0);
    current = parent;
  }
  return false;
}

async function listeningSocketInodes(pid, port) {
  const portHex = port.toString(16).toUpperCase().padStart(4, '0');
  const tables = await Promise.all(
    [`/proc/${pid}/net/tcp`, `/proc/${pid}/net/tcp6`].map(async (file) => {
      try {
        return await readFile(file, 'utf8');
      } catch {
        return '';
      }
    }),
  );
  return [...new Set(tables.flatMap((table) =>
    table.split(/\r?\n/u).slice(1).flatMap((line) => {
      const fields = line.trim().split(/\s+/u);
      if (fields.length < 10) return [];
      const [localAddress, localPort] = fields[1]?.split(':') || [];
      return localAddress === '0100007F' &&
        localPort === portHex &&
        fields[3] === '0A'
        ? [fields[9]]
        : [];
    })))]
    .sort();
}

export async function inspectProcessLoopbackListeners(pid) {
  const [table, processSockets] = await Promise.all([
    readFile(`/proc/${pid}/net/tcp`, 'utf8'),
    processSocketInodes(pid),
  ]);
  return table.split(/\r?\n/u).slice(1).flatMap((line) => {
    const fields = line.trim().split(/\s+/u);
    if (fields.length < 10) return [];
    const [localAddress, localPort] = fields[1]?.split(':') || [];
    const inode = fields[9];
    if (
      localAddress !== '0100007F' ||
      fields[3] !== '0A' ||
      !processSockets.has(inode)
    ) {
      return [];
    }
    const port = Number.parseInt(localPort, 16);
    return [{
      endpoint: `http://127.0.0.1:${port}`,
      socketFingerprint: sha256(`${port}:${inode}`),
    }];
  }).toSorted((left, right) =>
    left.endpoint.localeCompare(right.endpoint) ||
    left.socketFingerprint.localeCompare(right.socketFingerprint));
}

export function fingerprintProcessLoopbackListeners(listeners) {
  return sha256(canonicalJson(listeners));
}

async function processSocketInodes(pid) {
  const directory = `/proc/${pid}/fd`;
  const entries = await readdir(directory);
  const targets = await Promise.all(entries.map(async (entry) => {
    try {
      return await readlink(path.join(directory, entry));
    } catch {
      return '';
    }
  }));
  return new Set(targets.flatMap((target) => {
    const match = target.match(/^socket:\[([0-9]+)\]$/u);
    return match ? [match[1]] : [];
  }));
}

async function attestEndpointOwnership(pid, endpoint) {
  const normalizedEndpoint = new URL(endpoint).origin;
  const port = Number(new URL(normalizedEndpoint).port || 80);
  const [listeners, processSockets] = await Promise.all([
    listeningSocketInodes(pid, port),
    processSocketInodes(pid),
  ]);
  const owned = listeners.filter((inode) => processSockets.has(inode));
  if (owned.length === 0) {
    throw new Error('verified product driver does not own the ready endpoint');
  }
  const ownedListeners = owned.map((inode) => ({
    endpoint: normalizedEndpoint,
    socketFingerprint: sha256(`${port}:${inode}`),
  })).toSorted((left, right) =>
    left.socketFingerprint.localeCompare(right.socketFingerprint));
  return {
    endpoint: normalizedEndpoint,
    inodes: owned,
    fingerprint: fingerprintProcessLoopbackListeners(ownedListeners),
    listenerFingerprints: ownedListeners.map((entry) => entry.socketFingerprint),
  };
}

async function trackedTreeClean(directory) {
  return (await git(directory, ['status', '--porcelain=v1', '--untracked-files=no'])) === '';
}

export async function createReturnCovenantDriverAttestation({
  plan,
  sourceDir,
  docsDir,
  ready,
  launch,
}) {
  const planErrors = validateReturnCovenantPlan(plan);
  if (planErrors.length > 0) {
    throw new Error(`invalid return covenant plan: ${planErrors.join('; ')}`);
  }
  if (plan.driver.fixtureCommand.status !== 'available') {
    throw new Error('product-owned fixture command is not available');
  }
  if (
    !launch ||
    launch.createdByTrustedLauncher !== true ||
    !Number.isInteger(launch.driverPid) ||
    launch.driverPid <= 1 ||
    !Number.isInteger(launch.launcherPid) ||
    launch.launcherPid <= 1 ||
    !/^[a-f0-9]{64}$/u.test(launch.launcherStartFingerprint || '') ||
    !/^[a-f0-9]{64}$/u.test(launch.observerKeyFingerprint || '') ||
    !Array.isArray(launch.driverArgs) ||
    !/^[a-f0-9]{64}$/u.test(launch.gatewayTokenFingerprint || '') ||
    !Number.isInteger(launch.sandboxPid) ||
    launch.sandboxPid <= 1 ||
    !/^[a-f0-9]{64}$/u.test(launch.sandboxStartFingerprint || '') ||
    typeof launch.launchNonce !== 'string' ||
    launch.launchNonce.length < 24 ||
    typeof launch.phaseSigningKey !== 'string' ||
    launch.phaseSigningKey.length < 32
    ||
    !Number.isInteger(launch.processGroupId) ||
    launch.processGroupId <= 1 ||
    !validateReturnCovenantRuntimeArtifactBinding(launch.runtimeArtifact)
  ) {
    throw new Error('trusted launcher receipt is required');
  }
  const relativePath = plan.driver.fixtureCommand.relativePath;
  if (!safeRelativePath(relativePath)) {
    throw new Error('fixture command must be a normalized product-relative path');
  }
  const [sourceRoot, docsRoot] = await Promise.all([
    realpath(sourceDir),
    realpath(docsDir),
  ]);
  const [
    runRoot,
    homePath,
    statePath,
    configPath,
    runtimeArtifactPath,
  ] = await Promise.all([
    realpath(launch.runRoot),
    realpath(launch.homePath),
    realpath(launch.statePath),
    realpath(launch.configPath),
    realpath(launch.runtimeArtifactPath),
  ]);
  if (
    sourceRoot !== await realpath(launch.snapshotPath) ||
    ![sourceRoot, homePath, statePath, configPath, runtimeArtifactPath]
      .every((value) => pathWithin(value, runRoot)) ||
    pathWithin(runRoot, docsRoot) ||
    (launch.livePaths || []).some((value) =>
      pathWithin(runRoot, value) || pathWithin(value, runRoot))
  ) {
    throw new Error('trusted launcher isolation paths overlap live or external state');
  }
  const [
    runInfo,
    homeInfo,
    stateInfo,
    configInfo,
    runtimeArtifactInfo,
  ] = await Promise.all([
    lstat(runRoot),
    lstat(homePath),
    lstat(statePath),
    lstat(configPath),
    lstat(runtimeArtifactPath),
  ]);
  if (
    !runInfo.isDirectory() ||
    !homeInfo.isDirectory() ||
    !stateInfo.isDirectory() ||
    !configInfo.isFile() ||
    [runInfo, homeInfo, stateInfo, configInfo].some((info) =>
      info.isSymbolicLink() || (info.mode & 0o077) !== 0) ||
    !runtimeArtifactInfo.isDirectory() ||
    runtimeArtifactInfo.isSymbolicLink() ||
    (runtimeArtifactInfo.mode & 0o777) !== 0o555
  ) {
    throw new Error('trusted launcher isolation paths are not private real paths');
  }
  const driverPath = path.join(sourceRoot, relativePath);
  const driverStat = await lstat(driverPath);
  if (!driverStat.isFile() || driverStat.isSymbolicLink()) {
    throw new Error('fixture command must be a regular non-symlink file');
  }
  const gatewayRelativePath = plan.driver.gatewayCommand.relativePath;
  if (!safeRelativePath(gatewayRelativePath)) {
    throw new Error('gateway command must be a normalized product-relative path');
  }
  const gatewayPath = path.join(sourceRoot, gatewayRelativePath);
  const gatewayStat = await lstat(gatewayPath);
  if (!gatewayStat.isFile() || gatewayStat.isSymbolicLink()) {
    throw new Error('gateway command must be a regular non-symlink file');
  }

  const [
    sourceHead,
    sourceTree,
    docsHead,
    sourceClean,
    docsClean,
    treeEntry,
    workingBlob,
    driverBytes,
    gatewayTreeEntry,
    gatewayWorkingBlob,
    gatewayBytes,
    interpreterPath,
  ] = await Promise.all([
    git(sourceRoot, ['rev-parse', 'HEAD']),
    git(sourceRoot, ['rev-parse', 'HEAD^{tree}']),
    git(docsRoot, ['rev-parse', 'HEAD']),
    trackedTreeClean(sourceRoot),
    trackedTreeClean(docsRoot),
    git(sourceRoot, ['ls-tree', plan.target.candidateSha, '--', relativePath]),
    git(sourceRoot, ['hash-object', '--', relativePath]),
    readFile(driverPath),
    git(sourceRoot, ['ls-tree', plan.target.candidateSha, '--', gatewayRelativePath]),
    git(sourceRoot, ['hash-object', '--', gatewayRelativePath]),
    readFile(gatewayPath),
    realpath(process.execPath),
  ]);
  if (
    sourceHead !== plan.target.candidateSha ||
    sourceTree !== plan.target.productTreeSha ||
    docsHead !== plan.target.docsHarnessSha
  ) {
    throw new Error('product source or docs harness HEAD differs from the plan');
  }
  if (!sourceClean || !docsClean) {
    throw new Error('product source or docs harness has tracked modifications');
  }
  const treeMatch = treeEntry.match(/^[0-7]{6} blob ([a-f0-9]{40,64})\t(.+)$/u);
  if (!treeMatch || treeMatch[2] !== relativePath || treeMatch[1] !== workingBlob) {
    throw new Error('fixture command does not match the candidate Git blob');
  }
  const commandSha256 = sha256(driverBytes);
  if (commandSha256 !== plan.driver.fixtureCommand.sha256) {
    throw new Error('fixture command SHA-256 differs from the plan');
  }
  const gatewayTreeMatch = gatewayTreeEntry.match(
    /^[0-7]{6} blob ([a-f0-9]{40,64})\t(.+)$/u,
  );
  const gatewayCommandSha256 = sha256(gatewayBytes);
  if (
    !gatewayTreeMatch ||
    gatewayTreeMatch[2] !== gatewayRelativePath ||
    gatewayTreeMatch[1] !== gatewayWorkingBlob ||
    gatewayCommandSha256 !== plan.driver.gatewayCommand.sha256
  ) {
    throw new Error('gateway command does not match the candidate Git blob');
  }

  if (
    ready?.schema !== RETURN_COVENANT_DRIVER_READY_SCHEMA ||
    ready?.protocol !== RETURN_COVENANT_DRIVER_SCHEMA ||
    ready?.runId !== plan.runId ||
    ready?.rowId !== plan.rowId ||
    ready?.candidateSha !== plan.target.candidateSha ||
    ready?.productTreeSha !== plan.target.productTreeSha ||
    ready?.runtimeBuildSha !== plan.target.runtimeBuildSha ||
    ready?.docsHarnessSha !== plan.target.docsHarnessSha ||
    ready?.runtimeConfigSha256 !== plan.target.runtimeConfigSha256 ||
    ready?.runtimeArtifactManifestSha256 !==
      plan.target.runtimeArtifactManifestSha256 ||
    ready?.commandRelativePath !== relativePath ||
    ready?.commandSha256 !== commandSha256 ||
    ready?.gatewayCommandRelativePath !== gatewayRelativePath ||
    ready?.gatewayCommandSha256 !== gatewayCommandSha256 ||
    typeof ready?.launchNonce !== 'string' ||
    ready.launchNonce !== launch.launchNonce ||
    ready?.phaseKeyFingerprint !== sha256(launch.phaseSigningKey) ||
    !Number.isInteger(ready?.pid) ||
    ready.pid !== launch.driverPid ||
    !Number.isInteger(ready?.gatewayPid) ||
    ready.gatewayPid <= 1 ||
    ready.gatewayPid === ready.pid ||
    ready?.revocationCapability?.schema !==
      'openclaw.k6.return-covenant-capability-inventory.v1' ||
    ready?.revocationCapability?.source !== 'product-owned' ||
    ready?.revocationCapability?.productSha !== plan.target.candidateSha ||
    ready?.revocationCapability?.runtimeBuildSha !== plan.target.runtimeBuildSha ||
    ready?.revocationCapability?.runtimeConfigSha256 !==
      plan.target.runtimeConfigSha256 ||
    ready?.revocationCapability?.inventoryComplete !== true ||
    typeof ready?.revocationCapability?.revocationApiExposed !== 'boolean' ||
    typeof ready?.revocationCapability?.surface !== 'string' ||
    ready.revocationCapability.surface.length < 8 ||
    typeof ready?.revocationCapability?.receiptId !== 'string' ||
    ready.revocationCapability.receiptId.length < 8 ||
    !LOOPBACK_URL.test(ready?.endpoint || '') ||
    !LOOPBACK_URL.test(ready?.gatewayEndpoint || '')
  ) {
    throw new Error('product driver ready receipt is incomplete or mismatched');
  }

  const [
    driverProcess,
    gatewayProcess,
    driverSocket,
    gatewaySocket,
    gatewayBound,
    driverSandboxBound,
    gatewaySandboxBound,
  ] =
    await Promise.all([
    processIdentity(ready.pid),
    processIdentity(ready.gatewayPid),
    attestEndpointOwnership(ready.pid, ready.endpoint),
    attestEndpointOwnership(ready.gatewayPid, ready.gatewayEndpoint),
    isDescendantOrSelf(ready.gatewayPid, ready.pid),
    isDescendantOrSelf(ready.pid, launch.sandboxPid),
    isDescendantOrSelf(ready.gatewayPid, launch.sandboxPid),
  ]);
  const gatewayConfigPath = await processConfigPath(gatewayProcess);
  if (
    ready.endpoint !== driverSocket.endpoint ||
    ready.gatewayEndpoint !== gatewaySocket.endpoint ||
    ready.namespacePid !== driverProcess.namespacePid ||
    ready.namespaceGatewayPid !== gatewayProcess.namespacePid ||
    driverSocket.endpoint === gatewaySocket.endpoint ||
    driverSocket.inodes.some((inode) => gatewaySocket.inodes.includes(inode))
  ) {
    throw new Error('driver and gateway must own distinct loopback sockets');
  }
  if (
    driverProcess.cwd !== sourceRoot ||
    !exactNodeCommand(
      driverProcess,
      driverPath,
      interpreterPath,
      launch.driverArgs,
    ) ||
    !driverSandboxBound
  ) {
    throw new Error('ready process is not the verified product driver');
  }
  if (!gatewayBound) {
    throw new Error('isolated gateway process is outside the verified driver process tree');
  }
  if (
    gatewayProcess.cwd !== sourceRoot ||
    !exactNodeCommand(
      gatewayProcess,
      gatewayPath,
      interpreterPath,
      plan.driver.gatewayCommand.args,
    ) ||
    !gatewaySandboxBound
  ) {
    throw new Error('isolated gateway process is not the candidate gateway command');
  }
  for (const process of [driverProcess, gatewayProcess]) {
    if (
      process.environment.HOME !== launch.homePath ||
      process.environment.OPENCLAW_STATE_DIR !== launch.statePath ||
      process.environment.OPENCLAW_CONFIG_PATH !== launch.configPath ||
      process.environment.OPENCLAW_RETURN_COVENANT_PHASE_KEY !==
        launch.phaseSigningKey ||
      process.environment.OPENCLAW_PRODUCT_TREE_SHA !==
        plan.target.productTreeSha ||
      process.environment
        .OPENCLAW_RETURN_COVENANT_RUNTIME_ARTIFACT_SHA256 !==
        plan.target.runtimeArtifactManifestSha256 ||
      sha256(process.environment.OPENCLAW_GATEWAY_TOKEN || '') !==
        launch.gatewayTokenFingerprint
    ) {
      throw new Error('driver or gateway process escaped launcher isolation');
    }
  }
  const gatewayConfigStat = await lstat(gatewayConfigPath);
  if (!gatewayConfigStat.isFile() || gatewayConfigStat.isSymbolicLink()) {
    throw new Error('isolated gateway config must be a regular non-symlink file');
  }
  const gatewayConfig = JSON.parse(await readFile(gatewayConfigPath, 'utf8'));
  if (sha256(canonicalJson(gatewayConfig)) !== plan.target.runtimeConfigSha256) {
    throw new Error('isolated gateway config differs from the frozen runtime config');
  }

  const unsigned = {
    schema: RETURN_COVENANT_DRIVER_ATTESTATION_SCHEMA,
    runId: plan.runId,
    rowId: plan.rowId,
    candidateSha: plan.target.candidateSha,
    productTreeSha: plan.target.productTreeSha,
    runtimeBuildSha: plan.target.runtimeBuildSha,
    docsHarnessSha: plan.target.docsHarnessSha,
    runtimeConfigSha256: plan.target.runtimeConfigSha256,
    runtimeArtifact: launch.runtimeArtifact,
    endpoint: driverSocket.endpoint,
    command: {
      relativePath,
      sha256: commandSha256,
      gitBlob: workingBlob,
      trackedAtCandidate: true,
      workingTreeMatchesCandidate: true,
    },
    gatewayCommand: {
      relativePath: gatewayRelativePath,
      sha256: gatewayCommandSha256,
      gitBlob: gatewayWorkingBlob,
      trackedAtCandidate: true,
      workingTreeMatchesCandidate: true,
      args: plan.driver.gatewayCommand.args,
    },
    source: {
      headSha: sourceHead,
      treeSha: sourceTree,
      docsHeadSha: docsHead,
      trackedWorktreeClean: true,
      docsHarnessClean: true,
    },
    process: {
      commandContainsVerifiedDriver: true,
      endpointOwnedByVerifiedProcess: true,
      commandLineFingerprint: sha256(driverProcess.commandLine.join('\0')),
      startFingerprint: driverProcess.startFingerprint,
      endpointSocketFingerprint: driverSocket.fingerprint,
      listenerFingerprints: driverSocket.listenerFingerprints,
    },
    gateway: {
      processBound: true,
      commandLineFingerprint: sha256(gatewayProcess.commandLine.join('\0')),
      startFingerprint: gatewayProcess.startFingerprint,
      runtimeBuildSha: ready.runtimeBuildSha,
      runtimeConfigSha256: ready.runtimeConfigSha256,
      configPathFingerprint: sha256(gatewayConfigPath),
      endpoint: gatewaySocket.endpoint,
      socketFingerprint: gatewaySocket.fingerprint,
      listenerFingerprints: gatewaySocket.listenerFingerprints,
      namespacePid: gatewayProcess.namespacePid,
      namespaceStartFingerprint: gatewayProcess.namespaceStartFingerprint,
    },
    revocationCapability: ready.revocationCapability,
    readyReceiptSha256: sha256(canonicalJson(ready)),
    launchNonceFingerprint: sha256(ready.launchNonce),
    phaseChallenge: ready.launchNonce,
    phaseSigningKey: launch.phaseSigningKey,
    phaseKeyFingerprint: sha256(launch.phaseSigningKey),
    launcher: {
      createdByTrustedLauncher: true,
      launcherProcessFingerprint: launch.launcherStartFingerprint,
      snapshotFingerprint: sha256(sourceRoot),
      observerKeyFingerprint: launch.observerKeyFingerprint,
    },
    isolation: {
      runRoot,
      homePath,
      statePath,
      configPath,
      snapshotPath: sourceRoot,
      runtimeArtifactPath,
      runRootFingerprint: sha256(launch.runRoot),
      homeFingerprint: sha256(launch.homePath),
      stateFingerprint: sha256(launch.statePath),
      configFingerprint: sha256(launch.configPath),
      snapshotFingerprint: sha256(sourceRoot),
      runtimeArtifactFingerprint: sha256(runtimeArtifactPath),
      createdByTrustedLauncher: true,
      driverPid: ready.pid,
      gatewayPid: ready.gatewayPid,
      namespaceDriverPid: driverProcess.namespacePid,
      namespaceGatewayPid: gatewayProcess.namespacePid,
      processGroupId: launch.processGroupId,
      sandboxPid: launch.sandboxPid,
      sandboxStartFingerprint: launch.sandboxStartFingerprint,
      driverStartFingerprint: driverProcess.startFingerprint,
      gatewayStartFingerprint: gatewayProcess.startFingerprint,
      namespaceDriverStartFingerprint:
        driverProcess.namespaceStartFingerprint,
      namespaceGatewayStartFingerprint:
        gatewayProcess.namespaceStartFingerprint,
    },
  };
  const attestation = {
    ...unsigned,
    attestationSha256: sha256(canonicalJson(unsigned)),
  };
  const validation = validateReturnCovenantDriverAttestation({
    plan,
    attestation,
    endpoint: ready.endpoint,
  });
  if (validation.length > 0) {
    throw new Error(`generated driver attestation is invalid: ${validation.join('; ')}`);
  }
  return attestation;
}

export async function verifyReturnCovenantDirectCleanup(attestation) {
  const isolation = attestation?.isolation;
  const paths = [
    isolation?.runRoot,
    isolation?.homePath,
    isolation?.statePath,
    isolation?.configPath,
    isolation?.snapshotPath,
    isolation?.runtimeArtifactPath,
  ];
  const pathResults = await Promise.all(paths.map(async (value) => {
    if (!path.isAbsolute(value || '')) return false;
    try {
      await lstat(value);
      return false;
    } catch (error) {
      if (error?.code === 'ENOENT') return true;
      throw error;
    }
  }));
  const [driverCurrent, gatewayCurrent] = await Promise.all([
    currentProcessStartFingerprint(isolation?.driverPid),
    currentProcessStartFingerprint(isolation?.gatewayPid),
  ]);
  const sandboxCurrent = await currentProcessStartFingerprint(
    isolation?.sandboxPid,
  );
  const processGroupMembers = [];
  for (const entry of await readdir('/proc')) {
    if (!/^[0-9]+$/u.test(entry)) continue;
    try {
      const raw = await readFile(`/proc/${entry}/stat`, 'utf8');
      const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/u);
      if (Number(fields[2]) === isolation?.processGroupId) {
        processGroupMembers.push(Number(entry));
      }
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'EACCES') throw error;
    }
  }
  const driverStopped =
    driverCurrent === null ||
    driverCurrent !== isolation?.driverStartFingerprint;
  const gatewayStopped =
    gatewayCurrent === null ||
    gatewayCurrent !== isolation?.gatewayStartFingerprint;
  const sandboxStopped =
    sandboxCurrent === null ||
    sandboxCurrent !== isolation?.sandboxStartFingerprint;
  return {
    schema: 'openclaw.k6.return-covenant-direct-cleanup.v1',
    verified:
      pathResults.every(Boolean) &&
      driverStopped &&
      gatewayStopped &&
      sandboxStopped &&
      processGroupMembers.length === 0,
    runRootRemoved: pathResults[0] === true,
    homeRemoved: pathResults[1] === true,
    stateRemoved: pathResults[2] === true,
    configRemoved: pathResults[3] === true,
    snapshotRemoved: pathResults[4] === true,
    runtimeArtifactRemoved: pathResults[5] === true,
    driverStopped,
    gatewayStopped,
    sandboxStopped,
    processGroupEmpty: processGroupMembers.length === 0,
    isolationFingerprint: isolation?.runRootFingerprint || null,
  };
}
