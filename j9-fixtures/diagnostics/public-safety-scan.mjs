#!/usr/bin/env node
// Lane-private public-safety gate for fixture receipts before copying them
// into the lane branch. Applies the harness's own assertPublicArtifactSafe
// predicate (imported unchanged from run-max-chain-fixture.mjs) plus a
// credential-value scan and a private-path scan over the raw bytes.
// Usage: node public-safety-scan.mjs <docs-checkout> <private-path,...> <file>...
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [docsDir, privateList, ...files] = process.argv.slice(2);
const { assertPublicArtifactSafe } = await import(
  pathToFileURL(path.join(docsDir, 'tools/k6-proofs/scripts/run-max-chain-fixture.mjs')).href
);
const privatePaths = privateList.split(',').filter(Boolean);
const credentialPatterns = [
  ['github-token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}/u],
  ['anthropic/openai-key', /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}/u],
  ['slack-token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/u],
  ['aws-key', /\bAKIA[0-9A-Z]{16}\b/u],
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/u],
  ['discord-webhook', /discord(?:app)?\.com\/api\/webhooks\//iu],
  ['bearer', /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u],
  ['jwt', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./u],
  ['session-key', /\bagent:[a-z0-9:_-]+/iu],
];
let failed = false;
for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const problems = [];
  try {
    assertPublicArtifactSafe(JSON.parse(raw), { label: path.basename(file), privatePaths });
  } catch (error) {
    problems.push(`harness predicate: ${error.message}`);
  }
  for (const [name, pattern] of credentialPatterns) if (pattern.test(raw)) problems.push(`credential pattern: ${name}`);
  for (const privatePath of privatePaths) if (raw.includes(privatePath)) problems.push('private path present');
  if (problems.length) failed = true;
  console.log(`${problems.length ? 'UNSAFE' : 'safe  '} ${path.basename(file)}${problems.length ? ` :: ${problems.join('; ')}` : ''}`);
}
process.exitCode = failed ? 1 : 0;
