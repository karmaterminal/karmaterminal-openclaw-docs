import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  gatewayUrlFingerprint,
  READINESS_CLIENT,
  READINESS_SCHEMA,
  sealReadinessReceipt,
  selectedRows,
  sha256,
} from '../../target-readiness.mjs';

export function signedSeatReadinessFixture({
  signingKey,
  candidateSha,
  runtimeSha = candidateSha,
  docsSha,
  gatewayWs = 'ws://127.0.0.1:19893',
  seat,
  unit = 'openclaw-proof-fixture.service',
  rows,
  configuredDepth = 5,
  effectiveDepth = 5,
  requiredDepth = 2,
  expectedDepth = 5,
  seatClass = 'message-body',
}) {
  const connectRequestId = 'readiness-connect-fixture';
  const configRequestId = 'readiness-config-fixture';
  const fingerprint = gatewayUrlFingerprint(gatewayWs);
  return sealReadinessReceipt({
    schema: READINESS_SCHEMA,
    generatedAt: '2026-09-05T19:00:00.000Z',
    outcome: 'PASS-candidate',
    policy: { name: 'fixture', version: '1', source: 'fixture' },
    expectedK6Version: 'v2.0.0',
    k6: { ok: true, matchesExpected: true },
    gateway: { mode: 'authenticated-rpc', healthReachable: true },
    target: {
      gatewayUrlFingerprint: fingerprint,
      configuredMaxSpawnDepth: configuredDepth,
      effectiveMaxSpawnDepth: effectiveDepth,
      requiredMaxSpawnDepth: requiredDepth,
      expectedMaxSpawnDepth: expectedDepth,
      continuation: {
        configured: { enabled: true, defaultsPresent: true },
        effective: { enabled: true, defaultsPresent: true },
      },
      authentication: {
        scheme: 'gateway-token',
        authenticated: true,
        request: {
          connectRequestId,
          configRequestId,
          method: 'config.get',
          client: READINESS_CLIENT,
          role: 'operator',
          scopes: ['operator.read'],
          challengeHash: sha256('fixture-challenge'),
        },
        response: {
          protocol: 4,
          version: '2026.8.1',
          buildId: `2026.8.1-${runtimeSha.slice(0, 12)}-fixture`,
          bootIdHash: sha256('fixture-boot'),
          connectionIdHash: sha256('fixture-connection'),
          authRole: 'operator',
          authScopes: ['operator.read'],
          connectResponseId: connectRequestId,
          configResponseId: configRequestId,
          configRevisionHash: 'fixture-applied-config',
          appliedConfigHash: 'fixture-applied-config',
        },
      },
    },
    bindings: {
      candidateSha,
      runtimeSha,
      docsSha,
      gatewayUrlFingerprint: fingerprint,
      seat,
      unit,
      selectedRows: selectedRows(rows),
      requiredMaxSpawnDepth: requiredDepth,
      expectedMaxSpawnDepth: expectedDepth,
    },
    candidate: { sha: candidateSha, valid40Hex: true },
    seat: { name: seat, class: seatClass },
    session: { scope: 'agent-session' },
    env: [],
    concurrency: { safeToRunConcurrently: true, reason: 'fixture' },
    notes: [],
  }, signingKey);
}

export async function writeSignedSeatReadinessFixture({
  runDir,
  signingKey,
  metadata,
  rows = [metadata.row],
  unit = 'openclaw-proof-fixture.service',
}) {
  const receipt = signedSeatReadinessFixture({
    signingKey,
    candidateSha: metadata.candidateSha,
    runtimeSha: metadata.runtimeBuildSha,
    docsSha: metadata.docsRef,
    seat: metadata.seat,
    unit,
    rows,
  });
  const body = `${JSON.stringify(receipt, null, 2)}\n`;
  const runnerMetadata = {
    ...metadata,
    readiness: {
      receipt: 'seat-readiness.json',
      sha256: sha256(body),
      gatewayUrlFingerprint: receipt.bindings.gatewayUrlFingerprint,
      unit,
      selectedRows: receipt.bindings.selectedRows,
      requiredMaxSpawnDepth: receipt.bindings.requiredMaxSpawnDepth,
      expectedMaxSpawnDepth: receipt.bindings.expectedMaxSpawnDepth,
    },
  };
  await Promise.all([
    writeFile(
      path.join(runDir, 'runner-metadata.json'),
      `${JSON.stringify(runnerMetadata, null, 2)}\n`,
    ),
    writeFile(path.join(runDir, 'seat-readiness.json'), body),
  ]);
  return { metadata: runnerMetadata, receipt };
}
