/**
 * repo-root.mjs — the single repository-root contract for k6-proofs catalog tooling.
 *
 * Every catalog/manifest validator resolves exactly one repository root and then
 * joins `tools/k6-proofs` exactly once. Before this contract each validator used
 * `process.cwd()` directly, so invoking them from `tools/k6-proofs` resolved
 * `tools/k6-proofs/tools/k6-proofs/...` and reported an infrastructure ENOENT as
 * an empty catalog (#495).
 *
 * Resolution order:
 *   1. an explicit `--repo-root <dir>` argument;
 *   2. the `OPENCLAW_PROOFS_REPO_ROOT` environment variable;
 *   3. the nearest ancestor-or-self of the working directory that contains a
 *      `tools/k6-proofs` directory.
 *
 * Rule 3 makes the repository root, `tools/k6-proofs`, and `tools/k6-proofs/scripts`
 * all resolve to the same root, so the tool prefix can never be applied twice.
 * Resolution never silently falls back to the checkout that happens to contain
 * this module: a caller standing outside any proof harness fails closed with an
 * explicit contract error instead of validating an unrelated catalog.
 */
import { lstatSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export const PROOFS_TOOL_DIR = path.join('tools', 'k6-proofs');
export const REPO_ROOT_ENV_VAR = 'OPENCLAW_PROOFS_REPO_ROOT';
export const REPO_ROOT_FLAG = '--repo-root';
// A bare `tools/k6-proofs` directory is not enough, and neither is one catalog
// directory: a proof harness always has both a manifest catalog and a scenario
// catalog. Requiring both stops an unrelated ancestor that merely happens to
// contain a similarly named path from capturing discovery.
const CATALOG_SENTINELS = ['manifests', 'scenarios'];

function isDirectory(candidate) {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function canonical(candidate) {
  try {
    return realpathSync(candidate);
  } catch {
    return path.resolve(candidate);
  }
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

// No file at `candidate` is fine: there is nothing to conflict with the
// repository-rooted file. Anything else must name that same file.
function isMissingOrSameRegularFile(candidate, expectedPath) {
  try {
    const info = lstatSync(candidate);
    const resolved = realpathSync.native(candidate);
    return info.isFile() && !info.isSymbolicLink() && resolved === expectedPath;
  } catch (error) {
    if (error?.code === 'ENOENT') return true;
    throw error;
  }
}

/**
 * A directory is a repository root when it directly contains `tools/k6-proofs`
 * and that directory holds both proof catalogs (`manifests` and `scenarios`).
 */
export function isRepositoryRoot(candidate) {
  if (!candidate) return false;
  const toolDir = path.join(candidate, PROOFS_TOOL_DIR);
  if (!isDirectory(toolDir)) return false;
  return CATALOG_SENTINELS.every((sentinel) => isDirectory(path.join(toolDir, sentinel)));
}

/**
 * Split `--repo-root <dir>` out of an argument list so callers can keep their own
 * flags. Returns the raw (unvalidated) value plus the remaining arguments.
 */
export function parseRepoRootArg(argv = []) {
  const rest = [];
  let repoRoot = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === REPO_ROOT_FLAG) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${REPO_ROOT_FLAG} requires a directory value`);
      repoRoot = value;
      index += 1;
      continue;
    }
    if (arg.startsWith(`${REPO_ROOT_FLAG}=`)) {
      const value = arg.slice(REPO_ROOT_FLAG.length + 1);
      if (!value) throw new Error(`${REPO_ROOT_FLAG} requires a directory value`);
      repoRoot = value;
      continue;
    }
    rest.push(arg);
  }
  return { repoRoot, rest };
}

function explicitRoot(value, source) {
  const resolved = canonical(path.resolve(value));
  if (!isRepositoryRoot(resolved)) {
    throw new Error(`${source} is not a repository root: no ${PROOFS_TOOL_DIR} proof catalog under ${resolved}`);
  }
  return resolved;
}

function walkUpFrom(cwd) {
  // Canonicalize first so a symlinked working directory walks the real tree.
  let current = canonical(path.resolve(cwd));
  for (;;) {
    if (isRepositoryRoot(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * Resolve the one repository root for a catalog validator.
 *
 * @param {{argv?: string[], cwd?: string, env?: NodeJS.ProcessEnv}} [options]
 * @returns {{root: string, source: string, rest: string[]}}
 */
export function resolveRepositoryRoot({ argv = [], cwd = process.cwd(), env = process.env } = {}) {
  const { repoRoot, rest } = parseRepoRootArg(argv);
  if (repoRoot) return { root: explicitRoot(repoRoot, REPO_ROOT_FLAG), source: REPO_ROOT_FLAG, rest };

  const fromEnv = env?.[REPO_ROOT_ENV_VAR];
  if (fromEnv) return { root: explicitRoot(fromEnv, REPO_ROOT_ENV_VAR), source: REPO_ROOT_ENV_VAR, rest };

  const discovered = walkUpFrom(cwd);
  if (!discovered) {
    throw new Error(
      `unable to resolve a repository root from ${path.resolve(cwd)}: ` +
      `no ancestor contains a ${PROOFS_TOOL_DIR} proof catalog. Pass ${REPO_ROOT_FLAG} <dir> or set ${REPO_ROOT_ENV_VAR}.`,
    );
  }
  return { root: discovered, source: 'cwd-ancestor', rest };
}

/** Join a path underneath the resolved `tools/k6-proofs` directory. */
export function proofsToolPath(root, ...segments) {
  return path.join(root, PROOFS_TOOL_DIR, ...segments);
}

/**
 * Resolve a regular, non-symlink file inside one canonical repository root.
 * Relative inputs are always rooted at the repository, never process.cwd().
 * A relative input must also resolve unambiguously: if the caller's actual
 * working directory names a different file at that same relative path,
 * resolution fails closed instead of silently preferring the repository-rooted
 * interpretation.
 *
 * @param {string} root - the repository root, resolved to its canonical path.
 * @param {string} input - an absolute path, or a path relative to the repository root.
 * @param {{cwd?: string, label?: string}} [options]
 * @returns {string} the canonical, symlink-free absolute path to the file.
 */
export function resolveRepositoryFile(root, input, {
  cwd = process.cwd(),
  label = 'repository file',
} = {}) {
  const repositoryRoot = canonical(path.resolve(root));
  if (!isRepositoryRoot(repositoryRoot)) {
    throw new Error(`${label} repository root is not a proof harness: ${repositoryRoot}`);
  }
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error(`${label} path is required`);
  }

  const supplied = input.trim();
  const candidate = path.resolve(repositoryRoot, supplied);
  if (!isWithin(repositoryRoot, candidate)) {
    throw new Error(`${label} escapes repository root`);
  }

  let info;
  try {
    info = lstatSync(candidate);
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error(`${label} does not exist under repository root`);
    throw error;
  }
  if (info.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
  if (!info.isFile()) throw new Error(`${label} must be a regular file`);

  const resolved = realpathSync.native(candidate);
  if (!isWithin(repositoryRoot, resolved)) {
    throw new Error(`${label} resolves outside repository root`);
  }
  if (resolved !== candidate) {
    throw new Error(`${label} path contains a symbolic link`);
  }

  if (!path.isAbsolute(supplied)) {
    const cwdCandidate = path.resolve(cwd, supplied);
    if (
      cwdCandidate !== candidate &&
      !isMissingOrSameRegularFile(cwdCandidate, resolved)
    ) {
      throw new Error(`${label} is ambiguous relative to the caller working directory`);
    }
  }
  return resolved;
}
