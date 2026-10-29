// A stub OpenClaw candidate for the R-CW-6 max-chain fixture.
//
// The docs checkout cannot run the candidate's Vitest, so this models the
// candidate seams the generated R-CW-6 tests depend on, as they stand at
// karmaterminal/openclaw 293c977f629f872a643fb94892603310b887293b:
//
// - the module layout the templates import and mock;
// - the real import lines of the owner modules that consume those mocks;
// - the database-worker lane: custody suites run only under the infra config,
//   and a file filter that the selected config excludes exits 0 with no tests;
// - the candidate chain-depth suite and its test titles.
//
// Fake pnpm, tsx and vitest executables stand in for the frozen install. The
// fake vitest applies Vitest's module-load rules (missing module, missing
// export on a factory mock) to each generated test, then plays the stub
// candidate's boundary and writes the receipts the real tests would write.
// It never stands in for the real candidate run: that is the operator's
// exact-SHA fixture fire.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const STUB_SEAM_SOURCE_SHA = '293c977f629f872a643fb94892603310b887293b';
export const STUB_PNPM_VERSION = '11.2.2';
const STUB_LOCKFILE = 'lockfileVersion: 9.0\n';
const HELPER_PATH = fileURLToPath(import.meta.url);

export const CANDIDATE_DELEGATE_SUITE =
  'src/auto-reply/continuation/delegate-dispatch.chain-depth-exhaustion.test.ts';
const DATABASE_WORKER_LANE_CONFIG = 'test/vitest/vitest.infra.config.ts';
const DATABASE_WORKER_TESTS = [CANDIDATE_DELEGATE_SUITE];
const CANDIDATE_DELEGATE_SUITE_TITLES = [
  'rejects a delegate when currentChainCount equals maxChainLength',
  'accepts a delegate at count 9/10, then rejects the next at 10/10',
  'marks the custody record as failed for chain-depth-rejected delegates',
];

// Owner import lines, verbatim from the candidate. Only modules that consume a
// mock some template installs are modeled.
const OWNER_SOURCES = {
  'src/auto-reply/continuation/delegate-dispatch.ts': [
    'import { spawnSubagentDirect } from "../../agents/subagents/spawn/subagent-spawn.js";',
    'import { enqueueSystemEventRaw as enqueueSystemEvent } from "../../infra/system-events.js";',
    'import { createSubsystemLogger } from "../../logging/subsystem.js";',
  ],
  'src/agents/command/attempt-execution.ts': [
    'import { runCliAgent } from "../cli-runner.js";',
    'import { runEmbeddedAgent, type EmbeddedAgentRunResult } from "../embedded-agent.js";',
    'import { isCliProvider } from "../model-selection.js";',
  ],
};

const PLAIN_MODULES = [
  'src/agents/admitted-run-context.test-support.ts',
  'src/agents/cli-runner.ts',
  'src/agents/embedded-agent.ts',
  'src/agents/model-runtime-aliases.ts',
  'src/agents/model-selection.ts',
  'src/agents/openclaw-tools.continuation.ts',
  'src/agents/provider-auth-aliases.ts',
  'src/agents/subagents/spawn/subagent-spawn.ts',
  'src/auto-reply/continuation/custody/custody.test-support.ts',
  'src/auto-reply/continuation/delegate-store.ts',
  'src/auto-reply/continuation/scheduler.ts',
  'src/auto-reply/continuation/state.ts',
  'src/auto-reply/continuation/work-dispatch.ts',
  'src/auto-reply/continuation/work-flow-state.ts',
  'src/config/config.ts',
  'src/config/sessions.ts',
  'src/config/sessions/session-accessor.ts',
  'src/config/sessions/store-writer-state.ts',
  'src/config/types.openclaw.ts',
  'src/infra/continuation-tracer.ts',
  'src/infra/system-event-ownership.ts',
  'src/infra/system-events.ts',
  'src/logging/subsystem.ts',
  'src/state/openclaw-agent-db.ts',
  'test/vitest/vitest.auto-reply.config.ts',
  DATABASE_WORKER_LANE_CONFIG,
];

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function writeRepoFile(root, relativePath, content) {
  const file = path.join(root, relativePath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/** Commit a stub candidate under `root` and return its SHA. */
export function writeStubCandidate(root) {
  for (const module of PLAIN_MODULES) writeRepoFile(root, module, '// stub candidate module\n');
  for (const [module, lines] of Object.entries(OWNER_SOURCES)) {
    writeRepoFile(root, module, `${lines.join('\n')}\n`);
  }
  writeRepoFile(
    root,
    CANDIDATE_DELEGATE_SUITE,
    `${CANDIDATE_DELEGATE_SUITE_TITLES.map((title) => `it(${JSON.stringify(title)}, async () => {});`).join('\n')}\n`,
  );
  writeRepoFile(root, 'package.json', `${JSON.stringify({ name: 'r-cw-6-stub-candidate', packageManager: `pnpm@${STUB_PNPM_VERSION}` })}\n`);
  writeRepoFile(root, 'pnpm-lock.yaml', STUB_LOCKFILE);
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'proof@example.invalid']);
  git(root, ['config', 'user.name', 'R-CW-6 stub candidate']);
  git(root, ['add', '--all']);
  git(root, ['commit', '--quiet', '-m', 'stub candidate']);
  return git(root, ['rev-parse', 'HEAD']);
}

/** Write a fake PATH `pnpm` whose frozen install yields stub tsx/vitest. */
export function writeStubToolchain(binDir) {
  mkdirSync(binDir, { recursive: true });
  const pnpm = path.join(binDir, 'pnpm');
  writeFileSync(pnpm, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(HELPER_PATH)} pnpm "$@"\n`);
  chmodSync(pnpm, 0o700);
}

function installStubDependencies(cwd) {
  const bin = path.join(cwd, 'node_modules', '.bin');
  mkdirSync(path.join(cwd, 'node_modules', '.pnpm'), { recursive: true });
  mkdirSync(bin, { recursive: true });
  writeFileSync(path.join(cwd, 'node_modules', '.pnpm', 'lock.yaml'), readFileSync(path.join(cwd, 'pnpm-lock.yaml')));
  writeFileSync(
    path.join(cwd, 'node_modules', '.modules.yaml'),
    `${JSON.stringify({ layoutVersion: 5, packageManager: `pnpm@${STUB_PNPM_VERSION}`, virtualStoreDir: '.pnpm' })}\n`,
  );
  for (const tool of ['tsx', 'vitest']) {
    const file = path.join(bin, tool);
    writeFileSync(file, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(HELPER_PATH)} ${tool} "$@"\n`);
    chmodSync(file, 0o700);
  }
}

// ── Vitest module-load model ────────────────────────────────────────────────

function skipQuoted(source, index) {
  const quote = source[index];
  let cursor = index + 1;
  while (cursor < source.length && source[cursor] !== quote) {
    cursor += source[cursor] === '\\' ? 2 : 1;
  }
  return cursor;
}

function matchingClose(source, openIndex) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const stack = [];
  for (let cursor = openIndex; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (char === '"' || char === "'" || char === '`') cursor = skipQuoted(source, cursor);
    else if (char === '/' && source[cursor + 1] === '/') cursor = source.indexOf('\n', cursor);
    else if (char in pairs) stack.push(pairs[char]);
    else if (char === stack.at(-1)) {
      stack.pop();
      if (stack.length === 0) return cursor;
    }
    if (cursor < 0) break;
  }
  throw new Error('unbalanced vi.mock call in generated test');
}

export function parseGeneratedTest(source) {
  const mocks = [];
  for (const match of source.matchAll(/vi\.mock\(\s*"([^"]+)"/gu)) {
    const open = match.index + match[0].indexOf('(');
    const factory = source.slice(open, matchingClose(source, open) + 1);
    const partial = /importOriginal|importActual/u.test(factory);
    const provided = new Set(
      [...factory.matchAll(/(?:^|[{,\s])([A-Za-z_$][\w$]*)\s*(?=:(?!:))/gu)].map((entry) => entry[1]),
    );
    mocks.push({ spec: match[1], partial, provided });
  }
  const imports = [...source.matchAll(/^import\s+(type\s+)?([\s\S]*?)\s+from\s+"([^"]+)";/gmu)]
    .filter((entry) => !entry[1])
    .map((entry) => ({ spec: entry[3], names: namedBindings(entry[2]) }));
  const dynamicImports = [...source.matchAll(/import\(\s*"([^"]+)"\s*\)/gu)].map((entry) => entry[1]);
  const titles = [...source.matchAll(/\bit\(\s*"([^"]+)"/gu)].map((entry) => entry[1]);
  return { mocks, imports, dynamicImports, titles };
}

function namedBindings(clause) {
  const braces = /\{([\s\S]*)\}/u.exec(clause)?.[1];
  if (!braces) return [];
  return braces
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry && !entry.startsWith('type '))
    .map((entry) => entry.split(/\s+as\s+/u)[0].trim());
}

function moduleIdFor(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec)).replace(/\.js$/u, '.ts');
}

/**
 * Load a generated test the way Vitest would in the stub candidate. Returns
 * `{ ok: true }` or the first failure Vitest would report.
 */
export function loadGeneratedTest(root, relativeFile, source) {
  const parsed = parseGeneratedTest(source);
  const mocked = new Map(parsed.mocks.map((mock) => [moduleIdFor(relativeFile, mock.spec), mock]));
  for (const entry of parsed.imports) {
    const id = moduleIdFor(relativeFile, entry.spec);
    if (id && !existsSync(path.join(root, id))) {
      return { ok: false, phase: 'module-load', message: `Error: Cannot find module '${entry.spec}' imported from ${relativeFile}` };
    }
    const owner = id ? OWNER_SOURCES[id] : undefined;
    for (const line of owner ?? []) {
      const [ownerImport] = parseGeneratedTest(line).imports;
      const mock = mocked.get(moduleIdFor(id, ownerImport.spec));
      if (!mock || mock.partial) continue;
      const missing = ownerImport.names.find((name) => !mock.provided.has(name));
      if (missing) {
        return {
          ok: false,
          phase: 'module-load',
          message: `Error: [vitest] No "${missing}" export is defined on the "${mock.spec}" mock. Did you forget to return it from "vi.mock"?`,
        };
      }
    }
  }
  for (const spec of parsed.dynamicImports) {
    const id = moduleIdFor(relativeFile, spec);
    if (id && !existsSync(path.join(root, id))) {
      return { ok: false, phase: 'test', message: `Error: Cannot find module '/${id.replace(/\.ts$/u, '.js')}' imported from ${relativeFile}` };
    }
  }
  return { ok: true, parsed, mocked };
}

/** Whether a loaded test mocks the spawn owner the candidate dispatcher imports. */
export function dispatcherSpawnOwnerMocked(mocked) {
  const dispatcher = 'src/auto-reply/continuation/delegate-dispatch.ts';
  const spawnLine = OWNER_SOURCES[dispatcher].find((line) => line.includes('spawnSubagentDirect'));
  const [spawnImport] = parseGeneratedTest(spawnLine).imports;
  return mocked.has(moduleIdFor(dispatcher, spawnImport.spec));
}

// ── Stub candidate boundary (what the real generated tests observe) ─────────

function writeJsonReceipt(envName, value) {
  const file = process.env[envName];
  if (!file) throw new Error(`${envName} is required`);
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function selectedMaximum(source) {
  const match = /const maxChainLength = (\d+);/u.exec(source);
  if (!match) throw new Error('generated test does not set maxChainLength');
  return Number(match[1]);
}

function playDelegateBoundary(source) {
  const max = selectedMaximum(source);
  writeJsonReceipt('RCW6_DELEGATE_RECEIPT_PATH', {
    schema: 'openclaw.project81.r-cw-6.selected-delegate-boundary.v1',
    configuredMaximum: max,
    initialCurrentChainCount: max - 1,
    attemptedHops: [max, max + 1],
    dispatched: 1,
    rejected: 1,
    resultingChainCount: max,
    spawnCalls: 1,
    rejectedBeforeSecondSpawn: true,
    spawnedOnlyAcceptedDelegate: true,
    durableDelegateStore: 'continuation-custody',
    rejectedFlowStatus: 'failed',
    rejectedRecordFailedForChainCap: true,
    chainCappedNoticeObserved: true,
  });
}

function playRuntimeBoundary(source) {
  const max = selectedMaximum(source);
  writeJsonReceipt('RCW6_RUNTIME_RECEIPT_PATH', {
    schema: 'openclaw.project81.r-cw-6.runtime-boundary.v1',
    configuredMaximum: max,
    initialCurrentChainCount: max - 2,
    structuredRejection: { code: 'chain-capped', currentChainCount: max, maxChainLength: max, attemptedHop: max + 1 },
    noSpawn: {
      flowCountBeforeRejectedHop: 2,
      flowCountAfterRejectedHop: 2,
      rejectedReasonAbsentFromDurableFlows: true,
      chainCountUnchanged: true,
    },
    durableState: {
      persistedCount: max,
      reloadedCount: max,
      recoveredBudgetReason: 'chain-capped',
      recoveredAttemptScheduled: false,
    },
  });
  writeJsonReceipt('RCW6_TYPED_RECEIPT_PATH', {
    schema: 'openclaw.project81.r-cw-6.typed-tool-surface.v1',
    configuredMaximum: max,
    initialCurrentChainCount: max - 2,
    registeredContinueWorkTools: 1,
    continueWorkToolExecutions: 3,
    realToolExecutorInvoked: true,
    capturedElections: 3,
    scheduledFlows: [
      { hop: max - 1, reason: 'R-CW-6 typed below-limit' },
      { hop: max, reason: 'R-CW-6 typed at-limit' },
    ],
    firstOverLimitFlowPresent: false,
    finalInMemoryCount: max,
    finalPersistedCount: max,
    capNoticeObserved: true,
  });
}

// A canned failing run whose raw text carries what must never be published.
function forcedFailure(cwd, relativeFile) {
  return [
    `\u001b[31m FAIL \u001b[39m |infra| ${relativeFile}`,
    `Error: stub forced failure for agent:main:subagent:r-cw-6-private-session`,
    ` ❯ ${path.join(cwd, relativeFile)}:1:1`,
  ].join('\n');
}

function parseVitestArgs(argv) {
  const args = { config: '', dir: '', files: [] };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--config') args.config = argv[++index];
    else if (arg === '--dir') args.dir = argv[++index];
    else if (!arg.startsWith('--')) args.files.push(arg);
  }
  return args;
}

function listTests(root, dir) {
  const absolute = path.join(root, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute)
    .filter((name) => name.endsWith('.test.ts'))
    .map((name) => path.posix.join(dir, name));
}

function appendLog(entry) {
  const file = process.env.RCW6_STUB_VITEST_LOG;
  if (file) writeFileSync(file, `${JSON.stringify(entry)}\n`, { flag: 'a', mode: 0o600 });
}

// Another process creating the private diagnostics dir mid-run (a second
// fixture run sharing it, or another user under a shared temp root).
function plantPrivateDir() {
  const dir = process.env.RCW6_STUB_PLANT_DIR;
  if (!dir || existsSync(dir)) return;
  mkdirSync(dir, { recursive: true });
  chmodSync(dir, 0o777);
  writeFileSync(path.join(dir, 'planted.json'), '{}\n');
}

function runStubVitest(argv, cwd) {
  plantPrivateDir();
  const args = parseVitestArgs(argv);
  const databaseWorkerLane = args.config === DATABASE_WORKER_LANE_CONFIG;
  const includeFile = process.env.OPENCLAW_VITEST_INCLUDE_FILE;
  let selected;
  if (includeFile) {
    selected = JSON.parse(readFileSync(includeFile, 'utf8'));
  } else if (args.files.length > 0) {
    // A file filter the selected config excludes: passWithNoTests, exit 0.
    selected = args.files.filter((file) => databaseWorkerLane || !DATABASE_WORKER_TESTS.includes(file));
  } else {
    selected = args.dir ? listTests(cwd, args.dir) : [];
  }
  const project = databaseWorkerLane ? 'infra' : 'auto-reply';
  const logEntry = { config: args.config, includeFile: Boolean(includeFile), selected, outcomes: [] };
  if (selected.length === 0) {
    process.stdout.write('\n RUN  stub\n\nNo test files found, exiting with code 0\n');
    appendLog(logEntry);
    return 0;
  }
  const lines = [];
  let failed = false;
  let passedCount = 0;
  for (const file of selected) {
    const source = readFileSync(path.join(cwd, file), 'utf8');
    const record = (status, message) => logEntry.outcomes.push({ file, status, message });
    if (file === CANDIDATE_DELEGATE_SUITE) {
      for (const title of CANDIDATE_DELEGATE_SUITE_TITLES) lines.push(` ✓ |${project}| ${file} > chain-depth exhaustion > ${title} 1ms`);
      passedCount += CANDIDATE_DELEGATE_SUITE_TITLES.length;
      record('passed');
      continue;
    }
    if (process.env.RCW6_STUB_FORCE_FAILURE && file.includes(process.env.RCW6_STUB_FORCE_FAILURE)) {
      process.stderr.write(`${forcedFailure(cwd, file)}\n`);
      failed = true;
      record('failed', 'forced failure');
      continue;
    }
    const loaded = loadGeneratedTest(cwd, file, source);
    if (!loaded.ok) {
      process.stderr.write(` FAIL  |${project}| ${file}\n${loaded.message}\n`);
      failed = true;
      record('failed', loaded.message);
      continue;
    }
    if (source.includes('custody/custody.test-support.js') && !databaseWorkerLane) {
      const message = 'SqliteWorkerError: Shared-state admission requires the host broker';
      process.stderr.write(` FAIL  |${project}| ${file}\n${message}\n`);
      failed = true;
      record('failed', message);
      continue;
    }
    if (file.includes('delegate-fixture')) {
      if (!dispatcherSpawnOwnerMocked(loaded.mocked)) {
        const message = 'stub candidate: the dispatcher reached an unmocked spawnSubagentDirect (a real subagent run)';
        process.stderr.write(` FAIL  |${project}| ${file}\n${message}\n`);
        failed = true;
        record('failed', message);
        continue;
      }
      playDelegateBoundary(source);
    } else {
      playRuntimeBoundary(source);
    }
    // A suite whose run exits 0 with valid receipts but whose titles the
    // runner no longer recognizes.
    const titles = process.env.RCW6_STUB_RETITLE && file.includes(process.env.RCW6_STUB_RETITLE)
      ? loaded.parsed.titles.map((_, index) => `renamed proof ${index + 1}`)
      : loaded.parsed.titles;
    for (const title of titles) lines.push(` ✓ |${project}| ${file} > ${title} 1ms`);
    passedCount += titles.length;
    record('passed');
  }
  process.stdout.write(`\n RUN  stub\n\n${lines.join('\n')}\n\n Test Files  ${failed ? '1 failed' : `${selected.length} passed`} (${selected.length})\n      Tests  ${failed ? `${passedCount} passed` : `${passedCount} passed (${passedCount})`}\n`);
  appendLog(logEntry);
  return failed ? 1 : 0;
}

function runStubTsx(argv) {
  const code = argv[argv.indexOf('--eval') + 1] ?? '';
  const max = Number(/const maxChainLength = (\d+);/u.exec(code)?.[1]);
  const cases = [max - 2, max - 1, max].map((currentChainCount) => ({
    currentChainCount,
    attemptedHop: currentChainCount + 1,
    outcome: currentChainCount >= max ? 'chain-capped' : null,
  }));
  process.stdout.write(`${JSON.stringify({ maxChainLength: max, cases })}\n`);
  return 0;
}

function runStubPnpm(argv, cwd) {
  if (argv[0] === '--version') {
    process.stdout.write(`${STUB_PNPM_VERSION}\n`);
    return 0;
  }
  if (argv[0] === 'install') {
    installStubDependencies(cwd);
    return 0;
  }
  return 64;
}

if (process.argv[1] === HELPER_PATH) {
  const [tool, ...argv] = process.argv.slice(2);
  const handlers = { pnpm: runStubPnpm, tsx: runStubTsx, vitest: runStubVitest };
  process.exitCode = handlers[tool](argv, process.cwd());
}
