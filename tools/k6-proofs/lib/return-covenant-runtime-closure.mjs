/**
 * Runtime covenant complete closure: which objects the candidate can actually
 * reach, and why each one entered or was lawfully skipped.
 *
 * This owns *selection policy* only. It never copies, never relaxes the
 * finished-tree scanner, and never widens a bound. The producer consumes the
 * decision; `scanImmutableEntry` stays untouched.
 *
 * Selection is by declared manifest graph, so it is reproducible from frozen
 * bytes alone and never from observed smoke behaviour. Verification is separate
 * and fails closed: a reference the policy cannot account for is an error, not a
 * warning.
 */
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';

export const RETURN_COVENANT_CLOSURE_SCHEMA =
  'openclaw.k6.return-covenant-runtime-closure.v1';

/** Reasons a root, package, edge or file entered the closure. */
export const CLOSURE_REASONS = Object.freeze({
  ROOT_EXPORT: 'root-export-target',
  ROOT_BIN: 'root-bin',
  ROOT_MAIN: 'root-main',
  ROOT_FIXTURE_COMMAND: 'root-fixture-command',
  ROOT_BUILD_INPUT: 'root-build-input',
  FIRST_PARTY_IMPORT: 'first-party-static-import',
  PACKAGE_DEPENDENCY: 'declared-dependency',
  PACKAGE_OPTIONAL: 'declared-optional-dependency',
  PACKAGE_PEER: 'declared-required-peer',
  PACKAGE_FILE: 'selected-package-file',
});

/** Reasons an edge was lawfully skipped; anything else fails closed. */
export const CLOSURE_SKIPS = Object.freeze({
  OPTIONAL_ABSENT: 'optional-edge-absent',
  OPTIONAL_INCOMPATIBLE: 'optional-edge-platform-incompatible',
  PEER_OPTIONAL_ABSENT: 'optional-peer-absent',
  UNREACHABLE_WORKSPACE: 'workspace-package-not-reachable',
});

const JS_EXTENSIONS = Object.freeze(['.js', '.mjs', '.cjs']);

/** Runtime builtins, taken from the executing Node rather than hand-listed. */
const BUILTIN_MODULES = new Set(builtinModules);

function isJsFile(file) {
  return JS_EXTENSIONS.includes(path.extname(file));
}

/** Classify a specifier: relative path, runtime builtin, or bare package. */
export function classifySpecifier(specifier, builtins = BUILTIN_MODULES) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return { kind: 'relative' };
  }
  if (specifier.startsWith('node:') || specifier.startsWith('data:')) {
    return { kind: 'builtin' };
  }
  const parts = specifier.split('/');
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  if (builtins.has(name)) return { kind: 'builtin' };
  return { kind: 'package', name };
}

/** A bare specifier's package name, or null when it is not a package. */
export function specifierPackageName(specifier) {
  const classified = classifySpecifier(specifier);
  return classified.kind === 'package' ? classified.name : null;
}

// A dynamic import cannot be aliased in ESM: the `import` keyword must appear
// literally before its parenthesis. A substring scan therefore cannot *miss* a
// dynamic site, though it may over-report one inside a string or comment.
// Over-reporting is the fail-closed direction, so the conservative scan is
// sound for this contract's purpose.
const DYNAMIC_SITE = /(?:^|[^A-Za-z0-9_$.])import\s*\(/g;

/**
 * Static import specifiers, parsed rather than pattern-matched.
 *
 * `vm.SourceTextModule` runs the real ESM parser without evaluating anything, so
 * `dependencySpecifiers` is the specification's own answer. A regular expression
 * cannot lex JavaScript: it both invents specifiers out of string and template
 * content and can miss real ones, and a missed specifier in a fail-closed proof
 * is the silent corruption this contract exists to prevent.
 */
export function parseStaticSpecifiers(source, identifier) {
  if (typeof vm.SourceTextModule !== 'function') {
    throw new Error(
      'closure verification requires node --experimental-vm-modules so module ' +
        'specifiers can be parsed instead of pattern-matched',
    );
  }
  try {
    return [...new Set(new vm.SourceTextModule(source, { identifier })
      .dependencySpecifiers)].toSorted();
  } catch (error) {
    throw new Error(
      `selected runtime file does not parse as a module: ${identifier}: ${error.message}`,
    );
  }
}

/** Parsed static specifiers plus a conservative count of dynamic sites. */
export function scanModuleReferences(text, identifier = 'closure-input.mjs') {
  const statics = parseStaticSpecifiers(text, identifier);
  let dynamicSites = 0;
  for (const _ of text.matchAll(DYNAMIC_SITE)) dynamicSites += 1;
  return { statics, dynamicSites };
}

/** Every export target a manifest declares, flattened across conditions. */
export function collectExportTargets(exportsField) {
  const targets = [];
  const walk = (value) => {
    if (typeof value === 'string') {
      targets.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };
  walk(exportsField);
  return [...new Set(targets)].toSorted();
}

/** True when a manifest's os/cpu/libc fields admit the recorded identity. */
export function platformAdmits(manifest, nodeIdentity) {
  const check = (field, actual) => {
    const declared = manifest?.[field];
    if (!Array.isArray(declared) || declared.length === 0) return true;
    const negated = declared.filter((entry) => entry.startsWith('!'));
    if (negated.length > 0) {
      return !negated.some((entry) => entry.slice(1) === actual);
    }
    return declared.includes(actual);
  };
  return check('os', nodeIdentity?.platform) &&
    check('cpu', nodeIdentity?.arch) &&
    check('libc', nodeIdentity?.libc);
}

async function readManifest(directory) {
  try {
    return JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

/** Node-style upward resolution of a bare package name from a directory. */
async function resolvePackageDir(fromDir, name, fence) {
  let cursor = fromDir;
  for (;;) {
    const candidate = path.join(cursor, 'node_modules', name);
    try {
      const info = await lstat(candidate);
      if (info.isDirectory() || info.isSymbolicLink()) {
        const resolved = await realpath(candidate);
        if (!resolved.startsWith(`${fence}${path.sep}`) && resolved !== fence) {
          throw new Error(
            `closure resolution escaped its fence: ${name} from ${fromDir}`,
          );
        }
        return resolved;
      }
    } catch (error) {
      if (error?.message?.startsWith('closure resolution escaped')) throw error;
    }
    if (cursor === fence) return null;
    const parent = path.dirname(cursor);
    if (parent === cursor) return null;
    cursor = parent;
  }
}

/** Every file of a selected package, excluding nested node_modules. */
async function packageFiles(packageDir, fence) {
  const files = [];
  const walk = async (directory) => {
    for (const entry of (await readdir(directory, { withFileTypes: true }))
      .toSorted((left, right) => left.name.localeCompare(right.name))) {
      if (entry.name === 'node_modules') continue;
      const child = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const resolved = await realpath(child);
        if (!resolved.startsWith(`${fence}${path.sep}`)) {
          throw new Error(`selected package file escapes the fence: ${child}`);
        }
        const info = await lstat(resolved);
        if (info.isDirectory()) {
          await walk(resolved);
          continue;
        }
        files.push(resolved);
        continue;
      }
      if (entry.isDirectory()) {
        await walk(child);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`selected package contains a special file: ${child}`);
      }
      files.push(child);
    }
  };
  await walk(packageDir);
  return files.toSorted();
}

/**
 * Declared roots of the runtime covenant closure.
 *
 * Taken from the frozen product's own packaging surface, never from a run:
 * every export target, every bin, main/module, the product fixture command with
 * the driver it loads, and the build inputs the harness already pins.
 */
export async function collectClosureRoots({
  sourceDir,
  fixtureCommandRelativePath,
  fixtureDriverRelativePath,
  buildInputRelativePaths = [],
}) {
  const manifest = await readManifest(sourceDir);
  if (!manifest) throw new Error('closure roots require a readable root manifest');
  const roots = new Map();
  const add = (relative, reason) => {
    if (!relative || typeof relative !== 'string') return;
    const normalized = relative.replace(/^\.\//u, '');
    if (!roots.has(normalized)) roots.set(normalized, reason);
  };
  for (const target of collectExportTargets(manifest.exports)) {
    add(target, CLOSURE_REASONS.ROOT_EXPORT);
  }
  const bin = manifest.bin;
  if (typeof bin === 'string') add(bin, CLOSURE_REASONS.ROOT_BIN);
  else if (bin && typeof bin === 'object') {
    for (const target of Object.values(bin)) add(target, CLOSURE_REASONS.ROOT_BIN);
  }
  add(manifest.main, CLOSURE_REASONS.ROOT_MAIN);
  add(manifest.module, CLOSURE_REASONS.ROOT_MAIN);
  add(fixtureCommandRelativePath, CLOSURE_REASONS.ROOT_FIXTURE_COMMAND);
  add(fixtureDriverRelativePath, CLOSURE_REASONS.ROOT_FIXTURE_COMMAND);
  for (const input of buildInputRelativePaths) {
    add(input, CLOSURE_REASONS.ROOT_BUILD_INPUT);
  }
  // A declared root that the frozen tree does not contain is a packaging defect,
  // not something to skip quietly.
  const missing = [];
  for (const relative of roots.keys()) {
    try {
      const info = await lstat(path.join(sourceDir, relative));
      if (!info.isFile()) missing.push(relative);
    } catch {
      missing.push(relative);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `declared runtime root is absent from the frozen tree: ${missing.toSorted().join(', ')}`,
    );
  }
  return [...roots.entries()]
    .map(([relativePath, reason]) => ({ relativePath, reason }))
    .toSorted((left, right) => left.relativePath.localeCompare(right.relativePath));
}

/**
 * Declared production package graph, with every lawful skip recorded.
 *
 * Required edges that cannot resolve fail closed. Optional edges may be absent
 * or platform-incompatible, and each such skip is recorded with its reason so
 * the inventory explains the shape of the closure rather than merely asserting
 * it.
 */
export async function selectClosurePackages({
  dependencyDir,
  nodeIdentity,
}) {
  const fence = path.dirname(dependencyDir);
  const rootManifest = await readManifest(fence);
  if (!rootManifest) {
    throw new Error('closure package selection requires a readable root manifest');
  }
  const selected = new Map();
  const skipped = [];
  const edges = [];
  const pending = [];
  const enqueue = (fromDir, fromLabel, manifest) => {
    for (const [field, reason, optional] of [
      ['dependencies', CLOSURE_REASONS.PACKAGE_DEPENDENCY, false],
      ['optionalDependencies', CLOSURE_REASONS.PACKAGE_OPTIONAL, true],
    ]) {
      for (const name of Object.keys(manifest?.[field] ?? {}).toSorted()) {
        pending.push({ fromDir, fromLabel, name, reason, optional });
      }
    }
    const peerMeta = manifest?.peerDependenciesMeta ?? {};
    for (const name of Object.keys(manifest?.peerDependencies ?? {}).toSorted()) {
      pending.push({
        fromDir,
        fromLabel,
        name,
        reason: CLOSURE_REASONS.PACKAGE_PEER,
        optional: peerMeta?.[name]?.optional === true,
        peer: true,
      });
    }
  };
  enqueue(fence, '<root>', rootManifest);
  while (pending.length > 0) {
    const edge = pending.shift();
    const resolved = await resolvePackageDir(edge.fromDir, edge.name, fence);
    if (resolved === null) {
      if (!edge.optional) {
        throw new Error(
          `required ${edge.peer ? 'peer ' : ''}dependency does not resolve inside the closure: ` +
            `${edge.name} from ${edge.fromLabel}`,
        );
      }
      skipped.push({
        name: edge.name,
        from: edge.fromLabel,
        reason: edge.peer
          ? CLOSURE_SKIPS.PEER_OPTIONAL_ABSENT
          : CLOSURE_SKIPS.OPTIONAL_ABSENT,
      });
      continue;
    }
    const manifest = await readManifest(resolved);
    if (!manifest) {
      throw new Error(`selected package has no readable manifest: ${edge.name}`);
    }
    if (!platformAdmits(manifest, nodeIdentity)) {
      if (!edge.optional) {
        throw new Error(
          `required dependency declares an incompatible platform: ${edge.name} ` +
            `(os=${JSON.stringify(manifest.os ?? null)} cpu=${JSON.stringify(manifest.cpu ?? null)} ` +
            `libc=${JSON.stringify(manifest.libc ?? null)})`,
        );
      }
      skipped.push({
        name: edge.name,
        from: edge.fromLabel,
        reason: CLOSURE_SKIPS.OPTIONAL_INCOMPATIBLE,
      });
      continue;
    }
    const label = `${manifest.name ?? edge.name}@${manifest.version ?? '0.0.0'}`;
    edges.push({
      from: edge.fromLabel,
      to: label,
      name: edge.name,
      reason: edge.reason,
    });
    // A peer edge confirms an existing selection; it never re-traverses, so a
    // peer cycle cannot loop.
    if (selected.has(resolved)) continue;
    selected.set(resolved, { label, reason: edge.reason, manifest });
    if (!edge.peer) enqueue(resolved, label, manifest);
  }
  return {
    fence,
    packages: [...selected.entries()]
      .map(([directory, value]) => ({
        directory,
        label: value.label,
        name: value.manifest.name ?? null,
        version: value.manifest.version ?? null,
        reason: value.reason,
      }))
      .toSorted((left, right) => left.directory.localeCompare(right.directory)),
    edges: edges.toSorted((left, right) =>
      left.from.localeCompare(right.from) || left.to.localeCompare(right.to)),
    skipped: skipped.toSorted((left, right) =>
      left.from.localeCompare(right.from) || left.name.localeCompare(right.name)),
  };
}

/**
 * Finite, reviewed target sets for dynamic specifiers.
 *
 * Empty by default and deliberately so: a dynamic site is lawful only when it
 * appears here with an enumerated, finite target list, and every target is
 * itself selected. An unlisted site fails closed wherever it occurs, including
 * third-party code, because an unbounded target set cannot be proved complete.
 */
export const RETURN_COVENANT_DYNAMIC_SPECIFIER_POLICY = Object.freeze({});

/**
 * First-party file closure, transitively from the declared roots.
 *
 * Relative specifiers are followed inside the first-party tree; a bare
 * specifier is satisfied by a selected package or by the product's own package
 * name. Chunks, data files and native sidecars enter because the module that
 * needs them references them, not because a directory happened to be nearby.
 */
export async function selectFirstPartyFileClosure({
  sourceDir,
  roots,
  selectedPackageNames,
  productPackageName,
  dynamicPolicy = RETURN_COVENANT_DYNAMIC_SPECIFIER_POLICY,
}) {
  const selected = new Map();
  const unresolved = [];
  const dynamicSites = [];
  const packageNames = new Set(selectedPackageNames);
  const candidatesFor = (fromFile, specifier) => {
    const base = path.resolve(path.dirname(fromFile), specifier);
    const attempts = [base];
    for (const extension of JS_EXTENSIONS) attempts.push(`${base}${extension}`);
    for (const extension of JS_EXTENSIONS) {
      attempts.push(path.join(base, `index${extension}`));
    }
    return attempts;
  };
  const pending = roots.map((root) => ({
    file: path.join(sourceDir, root.relativePath),
    reason: root.reason,
  }));
  while (pending.length > 0) {
    const { file, reason } = pending.shift();
    const relative = path.relative(sourceDir, file);
    if (relative.startsWith('..')) {
      throw new Error(`first-party closure escaped the product tree: ${file}`);
    }
    if (selected.has(relative)) continue;
    selected.set(relative, reason);
    if (!isJsFile(file)) continue;
    let text;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      throw new Error(`selected runtime file is unreadable: ${relative}`);
    }
    const { statics, dynamicSites: count } = scanModuleReferences(text, relative);
    if (count > 0) {
      const enumerated = dynamicPolicy[relative];
      if (!Array.isArray(enumerated)) {
        dynamicSites.push({ file: relative, sites: count });
      } else {
        for (const target of enumerated) statics.push(target);
      }
    }
    for (const specifier of statics) {
      const classified = classifySpecifier(specifier);
      if (classified.kind === 'builtin') continue;
      const bare = classified.kind === 'package' ? classified.name : null;
      if (bare === null) {
        let resolvedFile = null;
        for (const candidate of candidatesFor(file, specifier)) {
          try {
            const info = await lstat(candidate);
            if (info.isFile()) {
              resolvedFile = candidate;
              break;
            }
          } catch {
            // keep trying the remaining extension candidates
          }
        }
        if (resolvedFile === null) {
          unresolved.push({ from: relative, specifier });
          continue;
        }
        pending.push({ file: resolvedFile, reason: CLOSURE_REASONS.FIRST_PARTY_IMPORT });
        continue;
      }
      if (bare === productPackageName) continue;
      if (packageNames.has(bare)) continue;
      unresolved.push({ from: relative, specifier });
    }
  }
  if (unresolved.length > 0) {
    const shown = unresolved
      .toSorted((left, right) =>
        left.from.localeCompare(right.from) || left.specifier.localeCompare(right.specifier))
      .slice(0, 12)
      .map((entry) => `${entry.from} -> ${entry.specifier}`);
    throw new Error(
      `runtime reference does not resolve inside the closure (${unresolved.length} total): ` +
        shown.join('; '),
    );
  }
  if (dynamicSites.length > 0) {
    const shown = dynamicSites
      .toSorted((left, right) => left.file.localeCompare(right.file))
      .slice(0, 12)
      .map((entry) => `${entry.file} (${entry.sites})`);
    throw new Error(
      `dynamic runtime reference has no enumerated finite target set ` +
        `(${dynamicSites.length} files): ${shown.join('; ')}`,
    );
  }
  return [...selected.entries()]
    .map(([relativePath, reason]) => ({ relativePath, reason }))
    .toSorted((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export {
  packageFiles as collectSelectedPackageFiles,
  resolvePackageDir as resolveClosurePackageDir,
  readManifest as readClosureManifest,
};
