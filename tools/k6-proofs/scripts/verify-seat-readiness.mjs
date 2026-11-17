#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { harnessClientOverrides, validateReadinessReceipt } from './target-readiness.mjs';

const receiptPath = process.argv[2];
if (!receiptPath || process.argv.length !== 3) {
  console.error('usage: verify-seat-readiness.mjs <receipt.json>');
  process.exit(2);
}

// run-proofs.sh runs k6 with this environment right after this check, and connectFrame
// honours these overrides; the receipt vouches only for the harness identity.
const overrides = harnessClientOverrides();
if (overrides.length > 0) {
  console.error(`seat readiness receipt rejected: harness-client-override-set:${overrides.join(',')}`);
  process.exit(2);
}

let receipt;
try {
  receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
} catch {
  console.error('seat readiness receipt is missing or malformed');
  process.exit(2);
}

const result = validateReadinessReceipt(receipt, {
  signingKey: process.env.OPENCLAW_GATEWAY_TOKEN,
  candidateSha: process.env.OPENCLAW_CANDIDATE_SHA,
  runtimeSha: process.env.OPENCLAW_RUNTIME_SHA || process.env.OPENCLAW_RUNTIME_BUILD_SHA,
  docsSha: process.env.OPENCLAW_DOCS_SHA || process.env.OPENCLAW_PROOFS_DOCS_REF,
  gatewayWs: process.env.OPENCLAW_GATEWAY_WS,
  seat: process.env.OPENCLAW_SEAT_NAME,
  unit: process.env.OPENCLAW_GATEWAY_UNIT,
  rows: process.env.OPENCLAW_SELECTED_ROWS,
  requiredDepth: process.env.OPENCLAW_REQUIRED_MAX_SPAWN_DEPTH,
  expectedDepth: process.env.OPENCLAW_EXPECTED_MAX_SPAWN_DEPTH,
});

if (!result.valid) {
  console.error(`seat readiness receipt rejected: ${result.reason}`);
  process.exit(2);
}
console.log('seat readiness receipt verified');
