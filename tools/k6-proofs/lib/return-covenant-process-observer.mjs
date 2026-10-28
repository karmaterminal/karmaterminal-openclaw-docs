import { createHash } from 'node:crypto';
import {
  readFile,
  readlink,
  realpath,
} from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { canonicalJson } from './canonical-json.mjs';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function expectedProcessError(error) {
  return ['ENOENT', 'ESRCH', 'EACCES', 'EPERM'].includes(error?.code);
}

async function readProc(file, encoding) {
  try {
    return await readFile(file, encoding);
  } catch (error) {
    if (expectedProcessError(error)) return null;
    throw error;
  }
}

async function descendants(rootPid) {
  const result = [];
  const pending = [rootPid];
  const seen = new Set();
  while (pending.length > 0) {
    const pid = pending.shift();
    if (!Number.isInteger(pid) || seen.has(pid)) continue;
    seen.add(pid);
    result.push(pid);
    const children = await readProc(
      `/proc/${pid}/task/${pid}/children`,
      'utf8',
    );
    pending.push(...String(children || '')
      .trim()
      .split(/\s+/u)
      .filter(Boolean)
      .map(Number));
  }
  return result;
}

async function processLaunchIdentity(pid) {
  const [
    commandLineBytes,
    rawStat,
    rawStatus,
    cwdLink,
    executableLink,
  ] = await Promise.all([
    readProc(`/proc/${pid}/cmdline`),
    readProc(`/proc/${pid}/stat`, 'utf8'),
    readProc(`/proc/${pid}/status`, 'utf8'),
    readlink(`/proc/${pid}/cwd`).catch((error) => {
      if (expectedProcessError(error)) return null;
      throw error;
    }),
    readlink(`/proc/${pid}/exe`).catch((error) => {
      if (expectedProcessError(error)) return null;
      throw error;
    }),
  ]);
  if (
    !commandLineBytes ||
    !rawStat ||
    !rawStatus ||
    !cwdLink ||
    !executableLink
  ) {
    return null;
  }
  const fields = rawStat.slice(rawStat.lastIndexOf(')') + 2)
    .trim()
    .split(/\s+/u);
  const startTicks = fields[19];
  if (!startTicks) return null;
  const namespaceProcessId = Number(
    rawStatus.match(/^NSpid:\s+(.+)$/mu)?.[1]
      ?.trim()
      .split(/\s+/u)
      .at(-1) || pid,
  );
  try {
    return {
      pid,
      namespacePid: namespaceProcessId,
      commandLine: commandLineBytes.toString('utf8').split('\0').filter(Boolean),
      cwd: await realpath(cwdLink),
      executablePath: await realpath(executableLink),
      startFingerprint: sha256(`${pid}:${startTicks}`),
      namespaceStartFingerprint:
        sha256(`${namespaceProcessId}:${startTicks}`),
    };
  } catch (error) {
    if (expectedProcessError(error)) return null;
    throw error;
  }
}

export function returnCovenantObservedCommandKey({
  role,
  pid,
  startFingerprint,
}) {
  return `${role}:${pid}:${startFingerprint}`;
}

export function findReturnCovenantObservedCommand(
  observations,
  { role, pid, startFingerprint },
) {
  return observations.get(returnCovenantObservedCommandKey({
    role,
    pid,
    startFingerprint,
  })) ?? null;
}

async function sampleCommands({
  rootPid,
  commands,
  observations,
  expectedNode,
}) {
  for (const pid of await descendants(rootPid)) {
    const identity = await processLaunchIdentity(pid);
    if (!identity || identity.executablePath !== expectedNode) continue;
    for (const command of commands) {
      if (
        identity.commandLine[1] !== command.scriptPath ||
        canonicalJson(identity.commandLine.slice(2)) !==
          canonicalJson(command.args) ||
        identity.cwd !== command.cwd
      ) {
        continue;
      }
      const key = returnCovenantObservedCommandKey({
        role: command.role,
        pid,
        startFingerprint: identity.startFingerprint,
      });
      if (!observations.has(key)) {
        observations.set(key, {
          role: command.role,
          ...identity,
          commandLineSha256: sha256(identity.commandLine.join('\0')),
          observedAt: new Date().toISOString(),
          observedMonotonicMs: performance.now(),
          source: 'trusted-launcher-pre-title-procfs-v1',
        });
      }
    }
  }
}

export async function sampleReturnCovenantTrackedCommands({
  rootPid,
  commands,
  observations = new Map(),
}) {
  if (
    !Number.isInteger(rootPid) ||
    rootPid < 2 ||
    !Array.isArray(commands) ||
    commands.length < 1 ||
    commands.some((command) =>
      !['driver', 'gateway'].includes(command?.role) ||
      !path.isAbsolute(command?.scriptPath || '') ||
      !path.isAbsolute(command?.cwd || '') ||
      !Array.isArray(command?.args))
  ) {
    throw new Error('tracked command observer configuration is invalid');
  }
  await sampleCommands({
    rootPid,
    commands,
    observations,
    expectedNode: await realpath(process.execPath),
  });
  return observations;
}

export function startReturnCovenantTrackedCommandObserver({
  rootPid,
  commands,
  intervalMs = 2,
}) {
  if (!Number.isInteger(intervalMs) || intervalMs < 1 || intervalMs > 20) {
    throw new Error('tracked command observer interval is invalid');
  }
  const observations = new Map();
  const state = {
    active: true,
    error: null,
  };
  const promise = (async () => {
    const expectedNode = await realpath(process.execPath);
    while (state.active) {
      await sampleCommands({
        rootPid,
        commands,
        observations,
        expectedNode,
      });
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  })().catch((error) => {
    state.error = error;
    state.active = false;
  });
  return {
    observations,
    get error() {
      return state.error;
    },
    async stop() {
      state.active = false;
      await promise;
    },
  };
}
