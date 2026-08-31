export const RETURN_COVENANT_RUNTIME_ARTIFACT_SCHEMA =
  'openclaw.k6.return-covenant-runtime-artifact.v1';
export const RETURN_COVENANT_RUNTIME_ARTIFACT_BINDING_SCHEMA =
  'openclaw.k6.return-covenant-runtime-artifact-binding.v1';

export const RETURN_COVENANT_RUNTIME_MOUNTS = Object.freeze([
  Object.freeze({
    kind: 'dependency-closure',
    artifactPath: 'payload/node_modules',
    candidatePath: 'node_modules',
  }),
  Object.freeze({
    kind: 'build-output',
    artifactPath: 'payload/dist',
    candidatePath: 'dist',
  }),
]);

const SHA_40 = /^[a-f0-9]{40}$/u;
const SHA_256 = /^[a-f0-9]{64}$/u;
const RUN_ID = /^rcv-[a-f0-9]{32}$/u;

function exactKeys(value, keys) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((entry, index) => entry === expected[index]);
}

function validNodeIdentity(value) {
  return exactKeys(value, [
    'version',
    'platform',
    'arch',
    'modules',
    'napi',
    'executableSha256',
  ]) &&
    typeof value.version === 'string' &&
    value.version.length >= 2 &&
    typeof value.platform === 'string' &&
    value.platform.length >= 2 &&
    typeof value.arch === 'string' &&
    value.arch.length >= 2 &&
    typeof value.modules === 'string' &&
    value.modules.length >= 1 &&
    typeof value.napi === 'string' &&
    value.napi.length >= 1 &&
    SHA_256.test(value.executableSha256 || '');
}

export function validateReturnCovenantRuntimeArtifactBinding(binding) {
  return exactKeys(binding, [
    'schema',
    'rowId',
    'runId',
    'productSha',
    'productTreeSha',
    'docsHarnessSha',
    'manifestSha256',
    'closureSha256',
    'node',
    'mounts',
  ]) &&
    binding.schema === RETURN_COVENANT_RUNTIME_ARTIFACT_BINDING_SCHEMA &&
    binding.rowId === 'R-CD-RETURN-COVENANT-AUTHORITY' &&
    RUN_ID.test(binding.runId || '') &&
    SHA_40.test(binding.productSha || '') &&
    SHA_40.test(binding.productTreeSha || '') &&
    SHA_40.test(binding.docsHarnessSha || '') &&
    SHA_256.test(binding.manifestSha256 || '') &&
    SHA_256.test(binding.closureSha256 || '') &&
    validNodeIdentity(binding.node) &&
    Array.isArray(binding.mounts) &&
    binding.mounts.length === RETURN_COVENANT_RUNTIME_MOUNTS.length &&
    binding.mounts.every((entry, index) =>
      exactKeys(entry, [
        'kind',
        'artifactPath',
        'candidatePath',
        'readOnly',
        'inventorySha256',
      ]) &&
      entry.kind === RETURN_COVENANT_RUNTIME_MOUNTS[index].kind &&
      entry.artifactPath ===
        RETURN_COVENANT_RUNTIME_MOUNTS[index].artifactPath &&
      entry.candidatePath ===
        RETURN_COVENANT_RUNTIME_MOUNTS[index].candidatePath &&
      entry.readOnly === true &&
      SHA_256.test(entry.inventorySha256 || ''));
}

