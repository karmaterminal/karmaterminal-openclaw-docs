import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  canonicalJson,
  GATEWAY_HMAC_RECEIPT_ALGORITHM,
  sealSignedObserverReceipt,
  validateSignedObserverReceiptIntegrity,
} from './signed-observer-receipt.mjs';

export const ARTIFACT_AUTHORITY_SCHEMA = 'openclaw.k6.signed-artifact-allowlist.v1';

export function artifactSigningKey(env = process.env) {
  return env.OPENCLAW_ARTIFACT_MANIFEST_KEY ||
    env.OPENCLAW_GATEWAY_TOKEN ||
    env.OPENCLAW_PROCESS_RECEIPT_KEY ||
    '';
}

function expectedSchema(name) {
  if (/^tempo-trace-[a-f0-9]+\.json$/u.test(name)) return 'openclaw.k6.public-tempo-trace.v1';
  if (name === 'continuation-trace-correlation.json' ||
      name === 'continuation-correlation.json') {
    return new Set([
      'openclaw.k6.continuation-trace-correlation.v1',
      'openclaw.k6.r-cd-2-immutable-acquisition.v1',
    ]);
  }
  if (name === 'tool-trace-correlation.json') return 'openclaw.k6.tool-trace-correlation.v1';
  return null;
}

function inspectArtifact(directory, name) {
  const file = path.join(directory, name);
  const stat = lstatSync(file);
  if (!stat.isFile()) throw new Error(`artifact is not a regular file: ${name}`);
  const bytes = readFileSync(file);
  const requiredSchema = expectedSchema(name);
  let schema = null;
  if (name.endsWith('.json')) {
    const value = JSON.parse(bytes.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`artifact is not a JSON object: ${name}`);
    }
    schema = typeof value.schema === 'string' ? value.schema : null;
  }
  if (requiredSchema &&
      (requiredSchema instanceof Set ? !requiredSchema.has(schema) : schema !== requiredSchema)) {
    throw new Error(`artifact schema mismatch: ${name}`);
  }
  return {
    name,
    type: name.endsWith('.json') ? 'json-object' : 'regular-file',
    schema,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function canonicalAuthority(authority) {
  const { integrity, ...body } = authority;
  return canonicalJson({
    ...body,
    integrity: {
      algorithm: integrity?.algorithm || GATEWAY_HMAC_RECEIPT_ALGORITHM,
    },
  });
}

export function buildArtifactAuthority({ directory, names, signingKey }) {
  const unique = [...new Set(names)].sort();
  if (unique.length !== names.length) throw new Error('artifact allowlist contains duplicates');
  const authority = {
    schema: ARTIFACT_AUTHORITY_SCHEMA,
    files: unique.map((name) => inspectArtifact(directory, name)),
  };
  return sealSignedObserverReceipt({
    receipt: authority,
    signingKey,
    canonicalize: canonicalAuthority,
  });
}

export function validateArtifactAuthority({ authority, directory, names, signingKey }) {
  if (!authority || authority.schema !== ARTIFACT_AUTHORITY_SCHEMA ||
      !Array.isArray(authority.files) ||
      !authority.integrity || typeof authority.integrity !== 'object' ||
      Array.isArray(authority.integrity) ||
      JSON.stringify(Object.keys(authority.integrity).sort()) !==
        JSON.stringify(['algorithm', 'signature']) ||
      !validateSignedObserverReceiptIntegrity({
        receipt: authority,
        signingKey,
        canonicalize: canonicalAuthority,
      })) return false;
  const expected = [...new Set(names)].sort();
  if (expected.length !== names.length ||
      JSON.stringify(authority.files.map(({ name }) => name)) !== JSON.stringify(expected)) return false;
  try {
    return authority.files.every((declared) =>
      JSON.stringify(declared) === JSON.stringify(inspectArtifact(directory, declared.name)));
  } catch {
    return false;
  }
}
