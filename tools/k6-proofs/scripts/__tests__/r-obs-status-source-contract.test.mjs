import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { extractExportedFunctionBody } from '../../lib/source-function-extractor.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const proofsRoot = path.resolve(here, '../..');
const manifestPath = path.join(proofsRoot, 'manifests/r-obs-status.json');
const scenarioPath = path.join(proofsRoot, 'scenarios/r-obs-status.js');
const signatureEnd = '}): string | undefined {';

const splitModuleSource = `
export function formatStatusTextContinuationLine(params: {
  maxChainLength: number;
  chainCount: number;
  pending: number;
  staged: number;
  volitional: number;
}): string | undefined {
  const { maxChainLength, chainCount, pending, staged, volitional } = params;
  if (chainCount === 0 && pending === 0 && staged === 0 && volitional === 0) {
    return undefined;
  }
  const parts = [\`chain \${chainCount}/\${maxChainLength}\`];
  if (pending > 0) parts.push(\`\${pending} delegates pending\`);
  if (staged > 0) parts.push(\`\${staged} post-compaction staged\`);
  if (volitional > 0) parts.push(\`volitional: \${volitional}\`);
  return \`🔄 Continuation: \${parts.join(' | ')}\`;
}
`;

test('R-OBS-STATUS fetches the candidate-owned split formatter module', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const scenario = fs.readFileSync(scenarioPath, 'utf8');
  assert.equal(manifest.sourceContract.path, 'src/status/status-continuation-line.ts');
  assert.match(scenario, /src\/status\/status-continuation-line\.ts/);
  assert.doesNotMatch(scenario, /src\/status\/status-text\.ts/);
});

test('R-OBS-STATUS candidate body proves clean omission and active rendering', () => {
  const body = extractExportedFunctionBody(
    splitModuleSource,
    'formatStatusTextContinuationLine',
    signatureEnd,
  );
  const format = new Function('params', `'use strict';\n${body}`);
  const clean = format({ maxChainLength: 8, chainCount: 0, pending: 0, staged: 0, volitional: 0 });
  const active = format({ maxChainLength: 8, chainCount: 1, pending: 0, staged: 0, volitional: 0 });
  assert.equal(clean, undefined);
  assert.equal(active, '🔄 Continuation: chain 1/8');
});

test('R-OBS-STATUS candidate body renders pending delegate state', () => {
  const body = extractExportedFunctionBody(splitModuleSource, 'formatStatusTextContinuationLine', signatureEnd);
  const format = new Function('params', `'use strict';\n${body}`);
  assert.equal(
    format({ maxChainLength: 8, chainCount: 0, pending: 2, staged: 0, volitional: 0 }),
    '🔄 Continuation: chain 0/8 | 2 delegates pending',
  );
});

test('R-OBS-STATUS candidate body renders staged post-compaction state', () => {
  const body = extractExportedFunctionBody(splitModuleSource, 'formatStatusTextContinuationLine', signatureEnd);
  const format = new Function('params', `'use strict';\n${body}`);
  assert.equal(
    format({ maxChainLength: 8, chainCount: 0, pending: 0, staged: 1, volitional: 0 }),
    '🔄 Continuation: chain 0/8 | 1 post-compaction staged',
  );
});

test('R-OBS-STATUS candidate body renders volitional state', () => {
  const body = extractExportedFunctionBody(splitModuleSource, 'formatStatusTextContinuationLine', signatureEnd);
  const format = new Function('params', `'use strict';\n${body}`);
  assert.equal(
    format({ maxChainLength: 8, chainCount: 0, pending: 0, staged: 0, volitional: 1 }),
    '🔄 Continuation: chain 0/8 | volitional: 1',
  );
});

test('balanced extraction ignores braces in strings and comments', () => {
  const source = `
export function target(params: { value: number }): string | undefined {
  // } does not close the function
  const left = "{";
  const right = \`literal } \${params.value}\`;
  /* { neither does this } */
  return left + right;
}
export const after = true;
`;
  const body = extractExportedFunctionBody(source, 'target', '): string | undefined {');
  const target = new Function('params', `'use strict';\n${body}`);
  assert.equal(target({ value: 7 }), '{literal } 7');
  assert.doesNotMatch(body, /export const after/);
});

test('balanced extraction rejects the stale re-export-only aggregator', () => {
  const aggregator = `
import { formatStatusTextContinuationLine } from './status-continuation-line.js';
export { formatStatusTextContinuationLine };
`;
  assert.throws(
    () => extractExportedFunctionBody(aggregator, 'formatStatusTextContinuationLine', signatureEnd),
    /export was not found/,
  );
});

test('balanced extraction fails closed on a signature mismatch', () => {
  assert.throws(
    () => extractExportedFunctionBody(splitModuleSource, 'formatStatusTextContinuationLine', '): boolean {'),
    /signature marker was not found/,
  );
});

test('balanced extraction cannot borrow a matching signature from a later export', () => {
  const source = `
export function targetExtra(params: { value: number }): string | undefined {
  return "WRONG-PREFIX-BODY";
}

export function target(params: { value: number }): boolean {
  return params.value > 0;
}

export function later(params: { value: number }): string | undefined {
  return "WRONG-BODY";
}
`;
  assert.throws(
    () => extractExportedFunctionBody(source, 'target', '): string | undefined {'),
    /signature marker was not found/,
  );
});

test('balanced extraction fails closed on an unterminated body', () => {
  const unterminated = `
export function target(params: { value: number }): string | undefined {
  if (params.value) {
    return "value";
  }
`;
  assert.throws(
    () => extractExportedFunctionBody(unterminated, 'target', '): string | undefined {'),
    /closing brace was not found/,
  );
});
