// Candidate-local Node tools (tsx, vitest) for the process-local proof fixtures.
//
// A frozen pnpm install links every dependency bin into node_modules/.bin.
// pnpm up to 12.0 wrote each link as a symlink to the package's JS entry, so
// `node <realpath(.bin/x)>` ran that entry. From 12.3 pnpm writes a POSIX sh
// cmd-shim instead: realpath is then the shim itself, and Node fails on it
// with a SyntaxError. Running the shim as an executable would work, but the
// shim picks `node` from PATH, and the fixtures run candidate code only under
// their own trusted interpreter.
//
// So the fixtures run the JS entry that the installed package's own
// package.json `bin` declares, under process.execPath, and bind that entry
// back to the .bin link the install produced: a symlink must resolve to it,
// and a cmd-shim must name it on its `# cmd-shim-target=` line. Either kind
// leaves a pnpm 11 install running the same file as before.
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

const CMD_SHIM_TARGET = /^# cmd-shim-target=(.+)$/gmu;
const NODE_SCRIPT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function declaredBin(manifest, packageName, binName) {
  if (typeof manifest?.bin === 'string') {
    // A string bin is named after the package, without its scope.
    return binName === packageName.split('/').at(-1) ? manifest.bin : undefined;
  }
  const declared = manifest?.bin?.[binName];
  return typeof declared === 'string' ? declared : undefined;
}

function assertNodeScript(script, label) {
  const content = readFileSync(script);
  if (content.subarray(0, 2).toString('latin1') === '#!') {
    const newline = content.indexOf(0x0a);
    const shebang = content.subarray(2, newline === -1 ? content.length : newline).toString('utf8').trim();
    const words = shebang.split(/\s+/u);
    const interpreter = words[0] === '/usr/bin/env' ? words.slice(1) : words;
    if (interpreter.length !== 1 || path.basename(interpreter[0]) !== 'node') {
      throw new Error(`${label} bin entry requires an unsupported interpreter: #!${shebang}`);
    }
    return;
  }
  if (!NODE_SCRIPT_EXTENSIONS.has(path.extname(script))) {
    throw new Error(`${label} bin entry is not a Node script`);
  }
}

// The .bin link must lead to the entry about to run, so the fixture runs what
// the frozen install linked and not merely what a package happens to ship.
function binLinkKind(binPath, script, label) {
  if (lstatSync(binPath).isSymbolicLink()) {
    if (realpathSync(binPath) !== script) {
      throw new Error(`${label} .bin link does not resolve to the bin entry its package declares`);
    }
    return 'symlink';
  }
  const targets = [...readFileSync(binPath, 'utf8').matchAll(CMD_SHIM_TARGET)].map((match) => match[1].trim());
  if (targets.length !== 1) {
    throw new Error(`${label} .bin entry is neither a symlink nor a cmd-shim naming one target`);
  }
  const target = path.resolve(path.dirname(binPath), targets[0]);
  if (!existsSync(target) || realpathSync(target) !== script) {
    throw new Error(`${label} .bin cmd-shim does not target the bin entry its package declares`);
  }
  return 'cmd-shim';
}

/**
 * Resolve the JS entry a candidate-local tool runs under process.execPath.
 *
 * `binName` is the command under node_modules/.bin; `packageName` is the
 * direct dependency that declares it, by default the same name.
 */
export function resolveCandidateNodeBin(worktreeDir, binName, { packageName = binName } = {}) {
  const nodeModulesDir = path.join(worktreeDir, 'node_modules');
  const nodeModules = realpathSync(nodeModulesDir);
  const binPath = path.join(nodeModulesDir, '.bin', binName);
  if (!existsSync(binPath)) throw new Error(`candidate-local ${binName} executable is missing after frozen install`);
  if (!isInside(realpathSync(binPath), nodeModules)) {
    throw new Error(`candidate-local ${binName} executable resolves outside disposable node_modules`);
  }
  const label = `candidate-local ${binName}`;
  const packageLink = path.join(nodeModulesDir, packageName);
  if (!existsSync(path.join(packageLink, 'package.json'))) {
    throw new Error(`${label} package ${packageName} is not a direct dependency of the frozen install`);
  }
  const packageDir = realpathSync(packageLink);
  if (!isInside(packageDir, nodeModules)) {
    throw new Error(`${label} package ${packageName} resolves outside disposable node_modules`);
  }
  const manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  const declared = declaredBin(manifest, packageName, binName);
  if (!declared) throw new Error(`${label} package ${packageName} declares no ${binName} bin`);
  const entryPath = path.resolve(packageDir, declared);
  if (!isInside(entryPath, packageDir)) throw new Error(`${label} bin entry escapes package ${packageName}`);
  if (!existsSync(entryPath) || !lstatSync(entryPath).isFile() || lstatSync(entryPath).isSymbolicLink()) {
    throw new Error(`${label} bin entry is not a real file in package ${packageName}`);
  }
  const script = realpathSync(entryPath);
  if (!isInside(script, nodeModules)) {
    throw new Error(`${label} bin entry resolves outside disposable node_modules`);
  }
  assertNodeScript(script, label);
  return {
    binName,
    packageName,
    packageVersion: typeof manifest.version === 'string' ? manifest.version : null,
    entry: path.relative(packageDir, entryPath).split(path.sep).join('/'),
    binLink: binLinkKind(binPath, script, label),
    script,
  };
}
