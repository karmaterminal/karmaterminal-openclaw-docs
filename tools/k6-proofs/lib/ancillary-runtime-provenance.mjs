import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const SHA = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const TRUSTED_GIT = '/usr/bin/git';
const EXPECTED_COMPONENT_COUNT = 2;
const EXPECTED_CHANGED_PATH_COUNT = 22;

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function git(sourceDir, args) {
  return execFileSync(
    TRUSTED_GIT,
    ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-C', sourceDir, ...args],
    {
      encoding: 'utf8',
      env: {
        PATH: '/usr/bin:/bin',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_SYSTEM: '/dev/null',
        GIT_NO_REPLACE_OBJECTS: '1',
        GIT_TERMINAL_PROMPT: '0',
      },
      maxBuffer: 64 * 1024 * 1024,
    },
  ).trim();
}

function shapeMatchesReviewedRuntime(contract, row, canonicalSha, runtimeSha) {
  return contract?.schema === 'openclaw.k6.ancillary-runtime-contract.v1' &&
    contract?.row === row &&
    contract?.canonicalSha === canonicalSha &&
    contract?.runtimeSha === runtimeSha &&
    SHA.test(contract.canonicalTree || '') &&
    SHA.test(contract.runtimeTree || '');
}

function materialityAllowsRow(contract, row) {
  return contract?.materiality?.classification === 'ancillary-runtime-only' &&
    contract?.materiality?.canonicalIdentityRemainsPure === true &&
    contract.materiality.allowedRows?.includes(row) === true &&
    Array.isArray(contract.materiality.rowOwnerPaths) &&
    contract.materiality.rowOwnerPaths.length > 0;
}

function hasExpectedCommitAndPathShape(contract) {
  return Array.isArray(contract?.commits) &&
    contract.commits.length === EXPECTED_COMPONENT_COUNT &&
    Array.isArray(contract.changedPaths) &&
    contract.changedPaths.length === EXPECTED_CHANGED_PATH_COUNT &&
    new Set(contract.changedPaths).size === contract.changedPaths.length;
}

function validateShape(contract, row, canonicalSha, runtimeSha) {
  if (
    !shapeMatchesReviewedRuntime(contract, row, canonicalSha, runtimeSha) ||
    !materialityAllowsRow(contract, row) ||
    !hasExpectedCommitAndPathShape(contract)
  ) {
    throw new Error('ancillary runtime contract shape or row materiality is invalid');
  }
}

export function validateAncillaryRuntimeProvenance({
  contract,
  row,
  canonicalSha,
  runtimeSha,
  sourceDir,
}) {
  validateShape(contract, row, canonicalSha, runtimeSha);
  const canonicalTree = git(sourceDir, ['rev-parse', `${canonicalSha}^{tree}`]);
  const runtimeTree = git(sourceDir, ['rev-parse', `${runtimeSha}^{tree}`]);
  if (canonicalTree !== contract.canonicalTree || runtimeTree !== contract.runtimeTree) {
    throw new Error('ancillary runtime commit tree differs from reviewed contract');
  }
  git(sourceDir, ['merge-base', '--is-ancestor', canonicalSha, runtimeSha]);
  let parent = canonicalSha;
  for (const commit of contract.commits) {
    if (
      !SHA.test(commit.sha || '') ||
      commit.parent !== parent ||
      !SHA.test(commit.tree || '') ||
      !SHA256.test(commit.patchSha256 || '')
    ) {
      throw new Error('ancillary runtime commit chain is invalid');
    }
    const actualParent = git(sourceDir, ['rev-parse', `${commit.sha}^`]);
    const actualTree = git(sourceDir, ['rev-parse', `${commit.sha}^{tree}`]);
    const patch = git(sourceDir, ['diff', actualParent, commit.sha, '--']);
    if (
      actualParent !== commit.parent ||
      actualTree !== commit.tree ||
      digest(`${patch}\n`) !== commit.patchSha256
    ) {
      throw new Error(`ancillary runtime component ${commit.component} differs from reviewed bytes`);
    }
    parent = commit.sha;
  }
  if (parent !== runtimeSha) throw new Error('ancillary runtime chain does not terminate at runtime SHA');

  const changedPaths = git(sourceDir, ['diff', '--name-only', canonicalSha, runtimeSha, '--'])
    .split('\n')
    .filter(Boolean)
    .sort();
  if (JSON.stringify(changedPaths) !== JSON.stringify([...contract.changedPaths].sort())) {
    throw new Error('ancillary runtime changed-path union differs from reviewed contract');
  }
  const ownerDiff = git(sourceDir, [
    'diff',
    '--name-only',
    canonicalSha,
    runtimeSha,
    '--',
    ...contract.materiality.rowOwnerPaths,
  ]);
  if (ownerDiff) {
    throw new Error('ancillary runtime changes R-CD-TOKEN owner paths');
  }
  const contractSha256 = digest(`${JSON.stringify(contract)}\n`);
  return {
    schema: 'openclaw.k6.ancillary-runtime-provenance.v1',
    row,
    valid: true,
    canonicalSha,
    canonicalTree,
    runtimeSha,
    runtimeTree,
    contractSha256,
    commitChain: contract.commits.map(({ sha, parent: commitParent, tree, component, patchSha256 }) => ({
      sha,
      parent: commitParent,
      tree,
      component,
      patchSha256,
    })),
    changedPathCount: changedPaths.length,
    changedPathsSha256: digest(`${changedPaths.join('\n')}\n`),
    ownerPathsUnchanged: true,
    canonicalIdentityRemainsPure: true,
  };
}

export function readAncillaryRuntimeContract(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}
