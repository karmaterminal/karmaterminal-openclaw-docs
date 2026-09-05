import { realpathSync } from 'node:fs';
import path from 'node:path';

export const TRUSTED_SYSTEM_PATH = '/usr/bin:/bin';

export function withoutGitControlVariables(env = process.env) {
  return {
    ...Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith('GIT_'))),
    PATH: TRUSTED_SYSTEM_PATH,
  };
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
