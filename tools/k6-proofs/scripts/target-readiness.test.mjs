import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateTarget,
  gatewayUrlFingerprint,
  inspectTarget,
  observedContinuation,
  observedDepths,
  READINESS_CLIENT,
  sealReadinessReceipt,
  validateReadinessReceipt,
} from './target-readiness.mjs';
import { signedSeatReadinessFixture } from './__tests__/helpers/seat-readiness-fixture.mjs';

const values = {
  signingKey: 'target-readiness-test-token',
  candidateSha: '7cb9d71f622250bedbf565e327bd7d7b9d90b567',
  runtimeSha: '7cb9d71f622250bedbf565e327bd7d7b9d90b567',
  docsSha: 'd9fd19c6d3b587d36764d0184143b43885762ee1',
  gatewayWs: 'ws://127.0.0.1:21983',
  seat: 'isolated-seat',
  unit: 'openclaw-proof-129388.service',
  rows: ['R-CD-2', 'R-CD-TOKEN'],
  requiredDepth: 2,
  expectedDepth: 5,
};

function verify(receipt, overrides = {}) {
  return validateReadinessReceipt(receipt, { ...values, ...overrides });
}

test('signed v2 receipt validates every required binding', () => {
  const receipt = signedSeatReadinessFixture(values);
  assert.deepEqual(verify(receipt), { valid: true, reason: null });
  assert.equal(receipt.target.configuredMaxSpawnDepth, 5);
  assert.equal(receipt.target.effectiveMaxSpawnDepth, 5);
  assert.match(receipt.bindingDigest, /^[a-f0-9]{64}$/u);
});

test('wrong token, URL, seat, unit, SHA, rows, and stale v1 receipts reject', async (t) => {
  const receipt = signedSeatReadinessFixture(values);
  const hostile = [
    ['token', { signingKey: 'wrong-token' }, 'invalid-signature'],
    ['URL', { gatewayWs: 'ws://127.0.0.1:21984' }, 'binding-mismatch:gatewayUrlFingerprint'],
    ['seat', { seat: 'wrong-seat' }, 'binding-mismatch:seat'],
    ['unit', { unit: 'wrong.service' }, 'binding-mismatch:unit'],
    ['candidate SHA', { candidateSha: 'a'.repeat(40) }, 'binding-mismatch:candidateSha'],
    ['runtime SHA', { runtimeSha: 'b'.repeat(40) }, 'binding-mismatch:runtimeSha'],
    ['docs SHA', { docsSha: 'c'.repeat(40) }, 'binding-mismatch:docsSha'],
    ['rows', { rows: ['R-CD-2'] }, 'binding-mismatch:selectedRows'],
  ];
  for (const [name, override, reason] of hostile) {
    await t.test(name, () => assert.deepEqual(verify(receipt, override), { valid: false, reason }));
  }
  assert.deepEqual(
    verify({ ...receipt, schema: 'openclaw.k6.seat-readiness.v1' }),
    { valid: false, reason: 'invalid-receipt' },
  );
});

test('configured and effective depths come from distinct target config surfaces', () => {
  assert.deepEqual(observedDepths({
    sourceConfig: { agents: { defaults: { subagents: { maxSpawnDepth: 5 } } } },
    config: { agents: { defaults: { subagents: { maxSpawnDepth: 7 } } } },
  }), { configured: 5, effective: 7 });
  assert.deepEqual(observedDepths({
    config: { agents: { defaults: { subagents: { maxSpawnDepth: 1 } } } },
  }), { configured: null, effective: 1 });
});

test('query-bearing gateway URLs are rejected instead of fingerprinting a different target', () => {
  assert.equal(gatewayUrlFingerprint(`${values.gatewayWs}?token=ambient`), null);
});

test('malformed hello response fails before config.get', async () => {
  let configRequested = false;
  class MalformedHelloWebSocket {
    constructor() {
      queueMicrotask(() => this.onmessage({
        data: JSON.stringify({
          type: 'event',
          event: 'connect.challenge',
          payload: { nonce: 'server-nonce', ts: 1 },
        }),
      }));
    }

    send(raw) {
      const frame = JSON.parse(raw);
      if (frame.method === 'config.get') configRequested = true;
      queueMicrotask(() => this.onmessage({
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: { type: 'hello-ok', protocol: 3 },
        }),
      }));
    }

    close() {}
  }
  const result = await inspectTarget(values.gatewayWs, values.signingKey, {
    WebSocketImpl: MalformedHelloWebSocket,
  });
  assert.equal(result.authenticated, false);
  assert.equal(result.error, 'gateway-auth-rejected');
  assert.equal(configRequested, false);
});

test('target depth cases A-C ignore ambient host state and fail closed', () => {
  const continuation = {
    configured: { enabled: true, defaultsPresent: true },
    effective: { enabled: true, defaultsPresent: true },
  };
  const rpc = {
    authenticated: true,
    responseIdentity: { buildId: `2026.8.1-${values.runtimeSha.slice(0, 12)}-fixture` },
  };
  const base = {
    wsUrl: values.gatewayWs,
    configuredDepth: 5,
    effectiveDepth: 5,
    requiredDepth: 2,
    expectedDepth: 5,
    rpc,
    runtimeSha: values.runtimeSha,
    continuation,
  };
  assert.equal(evaluateTarget({ ...base, ambientHostDepth: null }).pass, true);
  assert.ok(evaluateTarget({
    ...base,
    configuredDepth: null,
    effectiveDepth: 1,
    ambientHostDepth: 5,
  }).notes.includes('configured-depth-unknown'));
  assert.ok(evaluateTarget({
    ...base,
    configuredDepth: 1,
    effectiveDepth: 1,
    ambientHostDepth: 5,
  }).notes.includes('effective-depth-insufficient'));
});

test('protocol handshake uses the canonical CLI identity and binds responses', async () => {
  class FakeWebSocket {
    constructor() {
      queueMicrotask(() => this.onmessage({
        data: JSON.stringify({
          type: 'event',
          event: 'connect.challenge',
          payload: { nonce: 'server-nonce', ts: 1 },
        }),
      }));
    }

    send(raw) {
      const frame = JSON.parse(raw);
      if (frame.method === 'connect') {
        assert.deepEqual(frame.params.client, READINESS_CLIENT);
        assert.deepEqual(frame.params.scopes, ['operator.read']);
        assert.equal(frame.params.auth.token, values.signingKey);
        queueMicrotask(() => this.onmessage({
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: true,
            payload: {
              type: 'hello-ok',
              protocol: 4,
              server: {
                version: '2026.8.1',
                buildId: `2026.8.1-${values.runtimeSha.slice(0, 12)}-fixture`,
                bootId: 'boot',
                connId: 'connection',
              },
              features: { methods: ['config.get'], events: ['connect.challenge'] },
              snapshot: {},
              auth: { role: 'operator', scopes: ['operator.read'] },
              policy: { maxPayload: 1024, maxBufferedBytes: 2048, tickIntervalMs: 1000 },
            },
          }),
        }));
      } else {
        assert.equal(frame.method, 'config.get');
        queueMicrotask(() => this.onmessage({
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: true,
            payload: {
              valid: true,
              sourceConfig: {
                agents: {
                  defaults: {
                    subagents: { maxSpawnDepth: 5 },
                    continuation: {
                      enabled: true,
                      maxChainLength: 3,
                      maxDelegatesPerTurn: 3,
                      costCapTokens: 1000,
                    },
                  },
                },
              },
              config: {
                agents: {
                  defaults: {
                    subagents: { maxSpawnDepth: 5 },
                    continuation: {
                      enabled: true,
                      maxChainLength: 3,
                      maxDelegatesPerTurn: 3,
                      costCapTokens: 1000,
                    },
                  },
                },
              },
              configRevisionHash: 'applied-revision',
              appliedConfigHash: 'applied-revision',
            },
          }),
        }));
      }
    }

    close() {}
  }

  const result = await inspectTarget(values.gatewayWs, values.signingKey, {
    WebSocketImpl: FakeWebSocket,
    timeoutMs: 100,
  });
  assert.equal(result.authenticated, true);
  assert.equal(result.requestIdentity.client.id, 'cli');
  assert.equal(result.responseIdentity.protocol, 4);
  assert.match(result.responseIdentity.connectionIdHash, /^[a-f0-9]{64}$/u);
  assert.deepEqual(observedContinuation(result.config), {
    configured: { enabled: true, defaultsPresent: true },
    effective: { enabled: true, defaultsPresent: true },
  });
});

test('authenticated config.get rejects a revision not applied by the running target', async () => {
  class UnappliedConfigWebSocket {
    constructor() {
      queueMicrotask(() => this.onmessage({
        data: JSON.stringify({
          type: 'event',
          event: 'connect.challenge',
          payload: { nonce: 'server-nonce', ts: 1 },
        }),
      }));
    }

    send(raw) {
      const frame = JSON.parse(raw);
      const payload = frame.method === 'connect'
        ? {
            type: 'hello-ok',
            protocol: 4,
            server: {
              version: '2026.8.1',
              buildId: `2026.8.1-${values.runtimeSha.slice(0, 12)}-fixture`,
              bootId: 'boot',
              connId: 'connection',
            },
            features: { methods: ['config.get'], events: ['connect.challenge'] },
            snapshot: {},
            auth: { role: 'operator', scopes: ['operator.read'] },
            policy: { maxPayload: 1024, maxBufferedBytes: 2048, tickIntervalMs: 1000 },
          }
        : {
            valid: true,
            sourceConfig: {},
            config: {},
            configRevisionHash: 'pending-revision',
            appliedConfigHash: 'running-revision',
          };
      queueMicrotask(() => this.onmessage({
        data: JSON.stringify({ type: 'res', id: frame.id, ok: true, payload }),
      }));
    }

    close() {}
  }

  const result = await inspectTarget(values.gatewayWs, values.signingKey, {
    WebSocketImpl: UnappliedConfigWebSocket,
    timeoutMs: 100,
  });
  assert.equal(result.authenticated, false);
  assert.equal(result.error, 'config-get-rejected');
});

test('a signed receipt with an unapplied target revision is invalid', () => {
  const receipt = signedSeatReadinessFixture(values);
  const unsigned = structuredClone(receipt);
  delete unsigned.integrity;
  unsigned.target.authentication.response.configRevisionHash = 'pending-revision';
  unsigned.target.authentication.response.appliedConfigHash = 'running-revision';
  const resigned = sealReadinessReceipt(unsigned, values.signingKey);
  assert.deepEqual(verify(resigned), { valid: false, reason: 'invalid-receipt' });
});

test('tampered client identity is rejected even with a valid signature', () => {
  const receipt = signedSeatReadinessFixture(values);
  const unsigned = structuredClone(receipt);
  delete unsigned.integrity;
  unsigned.target.authentication.request.client.id = 'gateway-client';
  const resigned = sealReadinessReceipt(unsigned, values.signingKey);
  assert.deepEqual(verify(resigned), { valid: false, reason: 'invalid-receipt' });
  assert.notEqual(gatewayUrlFingerprint(values.gatewayWs), gatewayUrlFingerprint('ws://127.0.0.1:1'));
});
