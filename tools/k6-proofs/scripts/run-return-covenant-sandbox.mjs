#!/usr/bin/env node
import { spawn } from 'node:child_process';
import {
  chmod,
  lstat,
  readFile,
  readdir,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {
  childTerminationReason,
} from '../lib/return-covenant-candidate-io.mjs';
import {
  RETURN_COVENANT_RUNTIME_MOUNT_OBSERVATION_SCHEMA,
} from '../lib/return-covenant-runtime-artifact-contract.mjs';

const EXIT_PREFIX = 'R_CD_RETURN_COVENANT_AUTHORITY_EXIT ';
const RUNTIME_MOUNT_PREFIX =
  'R_CD_RETURN_COVENANT_AUTHORITY_RUNTIME_MOUNTS ';

function parseArgs(argv) {
  const values = {};
  for (let index = 2; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error('invalid sandbox supervisor arguments');
    }
    values[flag.slice(2)] = value;
  }
  for (const name of [
    'driver',
    'driver-args',
    'attestation',
    'k6',
    'k6-config',
    'k6-home',
    'scenario',
    'plan',
    'runtime-mounts',
  ]) {
    if (!values[name]) throw new Error(`--${name} is required`);
  }
  return values;
}

async function firstRegularFile(directory) {
  for (const entry of (await readdir(directory)).toSorted()) {
    const file = path.join(directory, entry);
    const info = await lstat(file);
    if (info.isSymbolicLink()) {
      throw new Error(`runtime mount contains a symlink: ${file}`);
    }
    if (info.isFile()) return file;
    if (info.isDirectory()) {
      const nested = await firstRegularFile(file);
      if (nested) return nested;
      continue;
    }
    throw new Error(`runtime mount contains a special file: ${file}`);
  }
  return null;
}

async function requireChmodErofs(target, writableMode, label) {
  const originalMode = (await lstat(target)).mode & 0o777;
  try {
    await chmod(target, writableMode);
  } catch (error) {
    if (error?.code === 'EROFS') return 'EROFS';
    throw new Error(
      `${label} chmod failed with ${error?.code || error?.message}, expected EROFS`,
    );
  }
  await chmod(target, originalMode);
  throw new Error(`${label} chmod unexpectedly succeeded`);
}

async function requireCreateErofs(directory, label) {
  const probe = path.join(directory, '.return-covenant-write-probe');
  try {
    await writeFile(probe, 'must not write\n', { flag: 'wx' });
  } catch (error) {
    if (error?.code === 'EROFS') return 'EROFS';
    throw new Error(
      `${label} create failed with ${error?.code || error?.message}, expected EROFS`,
    );
  }
  await unlink(probe);
  throw new Error(`${label} create unexpectedly succeeded`);
}

async function observeRuntimeMounts(raw) {
  let mounts;
  try {
    mounts = JSON.parse(raw);
  } catch (error) {
    throw new Error(`--runtime-mounts is invalid JSON: ${error.message}`);
  }
  if (
    !Array.isArray(mounts) ||
    mounts.length !== 2 ||
    mounts.some((entry) =>
      typeof entry?.candidatePath !== 'string' ||
      !path.isAbsolute(entry?.absolutePath || ''))
  ) {
    throw new Error('--runtime-mounts must name two fixed absolute paths');
  }
  const observations = [];
  for (const mount of mounts) {
    const info = await lstat(mount.absolutePath);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`runtime mount is not a real directory: ${mount.candidatePath}`);
    }
    const file = await firstRegularFile(mount.absolutePath);
    if (!file) {
      throw new Error(`runtime mount is empty: ${mount.candidatePath}`);
    }
    observations.push({
      candidatePath: mount.candidatePath,
      directoryChmodErrno: await requireChmodErofs(
        mount.absolutePath,
        0o755,
        `${mount.candidatePath} directory`,
      ),
      fileChmodErrno: await requireChmodErofs(
        file,
        0o644,
        `${mount.candidatePath} file`,
      ),
      createErrno: await requireCreateErofs(
        mount.absolutePath,
        `${mount.candidatePath} directory`,
      ),
    });
  }
  return {
    schema: RETURN_COVENANT_RUNTIME_MOUNT_OBSERVATION_SCHEMA,
    source: 'trusted-sandbox-supervisor',
    manifestSha256:
      process.env.OPENCLAW_RETURN_COVENANT_RUNTIME_ARTIFACT_SHA256,
    mounts: observations,
  };
}

async function waitForFile(file, child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const termination = childTerminationReason(child);
    if (termination) {
      throw new Error(`product driver exited before attestation (${termination})`);
    }
    try {
      await readFile(file);
      return;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('driver attestation timed out inside sandbox');
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
  if (await waitForExit(child, 2_000) === null) {
    child.kill('SIGKILL');
    await waitForExit(child, 2_000);
  }
}

async function main() {
  const input = parseArgs(process.argv);
  const driverArgs = JSON.parse(input['driver-args']);
  if (!Array.isArray(driverArgs)) throw new Error('--driver-args must be JSON array');
  let driver;
  let k6;
  const terminate = () => {
    void stopChild(k6);
    void stopChild(driver);
  };
  process.once('SIGINT', terminate);
  process.once('SIGTERM', terminate);
  try {
    const runtimeMountObservation = await observeRuntimeMounts(
      input['runtime-mounts'],
    );
    process.stdout.write(
      `${RUNTIME_MOUNT_PREFIX}${JSON.stringify(runtimeMountObservation)}\n`,
    );
    driver = spawn(process.execPath, [input.driver, ...driverArgs], {
      cwd: path.dirname(input.driver),
      stdio: ['ignore', 'ignore', 'inherit'],
      env: process.env,
    });
    await waitForFile(input.attestation, driver);
    k6 = spawn(input.k6, [
      'run',
      '--config',
      input['k6-config'],
      '--log-format',
      'raw',
      '--log-output',
      'stdout',
      input.scenario,
    ], {
      cwd: input['k6-home'],
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH || '',
        HOME: input['k6-home'],
        OPENCLAW_RETURN_COVENANT_INPUT: input.plan,
        OPENCLAW_RETURN_COVENANT_DRIVER_ATTESTATION: input.attestation,
        OPENCLAW_RETURN_COVENANT_DRIVER_URL:
          JSON.parse(await readFile(input.attestation, 'utf8')).endpoint,
        OPENCLAW_GATEWAY_TOKEN: process.env.OPENCLAW_GATEWAY_TOKEN || '',
      },
    });
    k6.stdout.pipe(process.stdout, { end: false });
    k6.stderr.pipe(process.stdout, { end: false });
    const k6ExitCode = await waitForExit(k6, 31 * 60_000);
    if (k6ExitCode === null) {
      await stopChild(k6);
      throw new Error('k6 execution exceeded sandbox deadline');
    }
    const driverExitCode = await waitForExit(driver, 30_000);
    if (driverExitCode === null) {
      await stopChild(driver);
      throw new Error('driver did not stop after k6 teardown');
    }
    process.stdout.write(`${EXIT_PREFIX}${JSON.stringify({
      schema: 'openclaw.k6.return-covenant-sandbox-exit.v1',
      k6ExitCode,
      driverExitCode,
    })}\n`);
    process.exitCode = k6ExitCode === 0 && driverExitCode === 0
      ? 0
      : k6ExitCode || driverExitCode || 1;
  } finally {
    process.removeListener('SIGINT', terminate);
    process.removeListener('SIGTERM', terminate);
    await stopChild(k6);
    await stopChild(driver);
  }
}

main().catch((error) => {
  process.stderr.write(`return covenant sandbox failed: ${error.message}\n`);
  process.exitCode = 1;
});
