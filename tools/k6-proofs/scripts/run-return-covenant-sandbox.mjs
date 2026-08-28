#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const EXIT_PREFIX = 'R_CD_RETURN_COVENANT_AUTHORITY_EXIT ';

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
  ]) {
    if (!values[name]) throw new Error(`--${name} is required`);
  }
  return values;
}

async function waitForFile(file, child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`product driver exited before attestation (${child.exitCode})`);
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
  if (!child || child.exitCode !== null) return;
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
