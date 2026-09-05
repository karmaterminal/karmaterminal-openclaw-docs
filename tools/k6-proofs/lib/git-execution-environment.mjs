import { realpathSync } from 'node:fs';
import path from 'node:path';

export function withoutGitControlVariables(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith('GIT_')));
}

export function canonicalDirectory(directory) {
  return realpathSync(path.resolve(directory));
}

export function assertCanonicalGitCheckout(directory, runGit) {
  const canonical = canonicalDirectory(directory);
  const topLevel = canonicalDirectory(runGit(canonical, ['rev-parse', '--show-toplevel']));
  if (topLevel !== canonical) throw new Error('product directory must be the canonical Git worktree root');
  return canonical;
}
