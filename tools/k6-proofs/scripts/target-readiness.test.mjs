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
import { ab5aDeviceLessOperatorAdmission } from './__tests__/helpers/readiness-gateway.mjs';

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

test('signed v3 receipt validates every required binding', () => {
  const receipt = signedSeatReadinessFixture(values);
  assert.deepEqual(verify(receipt), { valid: true, reason: null });
  assert.equal(receipt.target.configuredMaxSpawnDepth, 5);
  assert.equal(receipt.target.effectiveMaxSpawnDepth, 5);
  assert.match(receipt.bindingDigest, /^[a-f0-9]{64}$/u);
});

test('wrong token, URL, seat, unit, SHA, rows, and stale v1/v2 receipts reject', async (t) => {
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
  for (const schema of ['openclaw.k6.seat-readiness.v1', 'openclaw.k6.seat-readiness.v2']) {
    assert.deepEqual(verify({ ...receipt, schema }), { valid: false, reason: 'invalid-receipt' });
  }
});

test('a re-signed v2 receipt from the cli identity is rejected', () => {
  // The exact shape the v2 harness wrote: connect as cli, no recorded auth method.
  const unsigned = structuredClone(signedSeatReadinessFixture(values));
  delete unsigned.integrity;
  unsigned.schema = 'openclaw.k6.seat-readiness.v2';
  unsigned.target.authentication.request.client = {
    id: 'cli',
    mode: 'cli',
    version: 'k6-proof-readiness-v2',
    platform: 'node',
  };
  delete unsigned.target.authentication.response.authMethod;
  assert.deepEqual(
    verify(sealReadinessReceipt(unsigned, values.signingKey)),
    { valid: false, reason: 'invalid-receipt' },
  );
});

test('the receipt must record an auth method that admits a token-only backend connect', async (t) => {
  for (const authMethod of ['none', 'token']) {
    await t.test(`accepts ${authMethod}`, () => {
      assert.deepEqual(verify(signedSeatReadinessFixture({ ...values, authMethod })), {
        valid: true,
        reason: null,
      });
    });
  }
  // device-token needs a device; password and the proxy methods are not what a
  // token-only connect gets; a missing method cannot say which path admitted it.
  for (const authMethod of [undefined, null, 'device-token', 'password', 'trusted-proxy', 'tailscale', 'NONE']) {
    await t.test(`rejects ${String(authMethod)}`, () => {
      const unsigned = structuredClone(signedSeatReadinessFixture(values));
      delete unsigned.integrity;
      if (authMethod === undefined) delete unsigned.target.authentication.response.authMethod;
      else unsigned.target.authentication.response.authMethod = authMethod;
      assert.deepEqual(verify(sealReadinessReceipt(unsigned, values.signingKey)), {
        valid: false,
        reason: 'invalid-receipt',
      });
    });
  }
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

// Updated deliberately from the canonical CLI identity (docs lane k6-readiness-backend-identity,
// 🕯 option B): an auth.mode=none Gateway refuses a device-less cli connect, so readiness now
// presents the row scenarios' backend identity (lib/gateway-client-identity.mjs).
test('protocol handshake uses the row scenarios\' backend identity and binds responses', async () => {
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
        assert.deepEqual(
          { id: frame.params.client.id, mode: frame.params.client.mode },
          { id: 'gateway-client', mode: 'backend' },
        );
        assert.equal(frame.params.role, 'operator');
        assert.deepEqual(frame.params.scopes, ['operator.read']);
        assert.equal(frame.params.device, undefined);
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
              auth: { method: 'token', role: 'operator', scopes: ['operator.read'] },
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
  assert.equal(result.requestIdentity.client.id, 'gateway-client');
  assert.equal(result.requestIdentity.client.mode, 'backend');
  assert.equal(result.responseIdentity.authMethod, 'token');
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
            auth: { method: 'token', role: 'operator', scopes: ['operator.read'] },
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

test('tampered client identity is rejected even with a valid signature', async (t) => {
  // Tampered toward the retired cli identity (it was tampered toward gateway-client
  // while readiness connected as cli).
  for (const [field, value] of [['id', 'cli'], ['mode', 'cli'], ['version', 'k6-proof-readiness-v2']]) {
    await t.test(`${field}=${value}`, () => {
      const unsigned = structuredClone(signedSeatReadinessFixture(values));
      delete unsigned.integrity;
      unsigned.target.authentication.request.client[field] = value;
      const resigned = sealReadinessReceipt(unsigned, values.signingKey);
      assert.deepEqual(verify(resigned), { valid: false, reason: 'invalid-receipt' });
    });
  }
  assert.notEqual(gatewayUrlFingerprint(values.gatewayWs), gatewayUrlFingerprint('ws://127.0.0.1:1'));
});

const readyConfig = {
  valid: true,
  sourceConfig: {
    agents: {
      defaults: {
        subagents: { maxSpawnDepth: 5 },
        continuation: { enabled: true, maxChainLength: 3, maxDelegatesPerTurn: 3, costCapTokens: 1000 },
      },
    },
  },
  config: {
    agents: {
      defaults: {
        subagents: { maxSpawnDepth: 5 },
        continuation: { enabled: true, maxChainLength: 3, maxDelegatesPerTurn: 3, costCapTokens: 1000 },
      },
    },
  },
  configRevisionHash: 'applied-revision',
  appliedConfigHash: 'applied-revision',
};

function helloOk(auth) {
  return {
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
    auth,
    policy: { maxPayload: 1024, maxBufferedBytes: 2048, tickIntervalMs: 1000 },
  };
}

// A target that answers connect the way openclaw ab5a30ea does for a device-less operator
// (see ab5aDeviceLessOperatorAdmission); `connectResponse` overrides that answer.
function ab5aTarget({ authMode, locality, token = values.signingKey, connectResponse = null }) {
  const methods = [];
  class Ab5aWebSocket {
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
      methods.push(frame.method);
      let response;
      if (frame.method === 'connect') {
        const admission = ab5aDeviceLessOperatorAdmission({ authMode, token, locality }, frame.params);
        response = connectResponse?.(frame) ?? (admission.ok
          ? {
              type: 'res',
              id: frame.id,
              ok: true,
              payload: helloOk({ method: admission.method, role: 'operator', scopes: admission.scopes }),
            }
          : { type: 'res', id: frame.id, ok: false, error: admission.error });
      } else {
        response = { type: 'res', id: frame.id, ok: true, payload: readyConfig };
      }
      queueMicrotask(() => this.onmessage({ data: JSON.stringify(response) }));
    }

    close() {}
  }
  return { WebSocketImpl: Ab5aWebSocket, methods };
}

function targetNotes(rpc) {
  return evaluateTarget({
    wsUrl: values.gatewayWs,
    configuredDepth: 5,
    effectiveDepth: 5,
    requiredDepth: 2,
    expectedDepth: 5,
    rpc,
    runtimeSha: values.runtimeSha,
    continuation: observedContinuation(rpc.config),
  }).notes;
}

test('the ab5a admission model refuses the v2 cli identity only on an auth.mode=none target', () => {
  const connect = (client, token = values.signingKey) => ({
    client, role: 'operator', scopes: ['operator.read'], auth: { token },
  });
  const cli = { id: 'cli', mode: 'cli' };
  const backend = { id: 'gateway-client', mode: 'backend' };
  const target = (authMode) => ({ authMode, token: values.signingKey });
  assert.equal(ab5aDeviceLessOperatorAdmission(target('none'), connect(cli)).error?.code, 'NOT_PAIRED');
  assert.equal(ab5aDeviceLessOperatorAdmission(target('none'), connect(backend)).method, 'none');
  assert.equal(ab5aDeviceLessOperatorAdmission(target('none'), connect(backend, 'any-token')).method, 'none');
  assert.equal(ab5aDeviceLessOperatorAdmission(target('token'), connect(cli)).method, 'token');
  assert.equal(ab5aDeviceLessOperatorAdmission(target('token'), connect(backend)).method, 'token');
  assert.equal(
    ab5aDeviceLessOperatorAdmission(target('token'), connect(backend, 'wrong')).error?.details?.code,
    'AUTH_TOKEN_MISMATCH',
  );
});

test('an auth.mode=none target admits readiness and the receipt records auth method none', async () => {
  const { WebSocketImpl, methods } = ab5aTarget({ authMode: 'none' });
  const result = await inspectTarget(values.gatewayWs, values.signingKey, { WebSocketImpl, timeoutMs: 100 });
  assert.equal(result.authenticated, true, result.error);
  assert.deepEqual(result.requestIdentity.client, READINESS_CLIENT);
  assert.equal(result.responseIdentity.authMethod, 'none');
  assert.deepEqual(result.responseIdentity.authScopes, ['operator.read']);
  assert.deepEqual(methods, ['connect', 'config.get']);
  assert.deepEqual(targetNotes(result), []);
});

test('an auth.mode=token target admits readiness with the shared token and records auth method token', async () => {
  const { WebSocketImpl, methods } = ab5aTarget({ authMode: 'token' });
  const result = await inspectTarget(values.gatewayWs, values.signingKey, { WebSocketImpl, timeoutMs: 100 });
  assert.equal(result.authenticated, true, result.error);
  assert.equal(result.responseIdentity.authMethod, 'token');
  assert.deepEqual(methods, ['connect', 'config.get']);
  assert.deepEqual(targetNotes(result), []);
});

test('a refused connect fails closed before config.get and names the Gateway refusal', async (t) => {
  const cases = [
    ['auth.mode=none, not local', { authMode: 'none', locality: 'remote' }, 'NOT_PAIRED/DEVICE_IDENTITY_REQUIRED'],
    ['auth.mode=token, wrong token', { authMode: 'token', token: 'other-token' }, 'INVALID_REQUEST/AUTH_TOKEN_MISMATCH'],
  ];
  for (const [name, target, rejection] of cases) {
    await t.test(name, async () => {
      const { WebSocketImpl, methods } = ab5aTarget(target);
      const result = await inspectTarget(values.gatewayWs, values.signingKey, { WebSocketImpl, timeoutMs: 100 });
      assert.equal(result.authenticated, false);
      assert.equal(result.error, 'gateway-auth-rejected');
      assert.equal(result.rejection, rejection);
      assert.equal(result.config, null);
      assert.equal(result.requestIdentity, null);
      assert.equal(result.responseIdentity, null);
      assert.deepEqual(methods, ['connect']);
      const notes = targetNotes(result);
      assert.ok(notes.includes('gateway-auth-rejected'), notes.join(','));
      assert.ok(notes.includes(`gateway-rejection:${rejection}`), notes.join(','));
    });
  }
});

test('an admission that drops the read scope fails closed before config.get', async () => {
  // A remote device-less operator on a token target is admitted with its scopes cleared.
  const { WebSocketImpl, methods } = ab5aTarget({ authMode: 'token', locality: 'remote' });
  const result = await inspectTarget(values.gatewayWs, values.signingKey, { WebSocketImpl, timeoutMs: 100 });
  assert.equal(result.authenticated, false);
  assert.equal(result.error, 'gateway-auth-rejected');
  assert.equal(result.rejection, null);
  assert.deepEqual(methods, ['connect']);
});

test('a hello without a readiness auth method fails closed before config.get', async (t) => {
  for (const method of [undefined, 'device-token', 'password', 'trusted-proxy']) {
    await t.test(String(method), async () => {
      const { WebSocketImpl, methods } = ab5aTarget({
        authMode: 'token',
        connectResponse: (frame) => ({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: helloOk({ method, role: 'operator', scopes: ['operator.read'] }),
        }),
      });
      const result = await inspectTarget(values.gatewayWs, values.signingKey, { WebSocketImpl, timeoutMs: 100 });
      assert.equal(result.authenticated, false);
      assert.equal(result.error, 'gateway-auth-method-unexpected');
      assert.deepEqual(methods, ['connect']);
    });
  }
});

test('a refusal records only well-formed Gateway codes, never the message', async (t) => {
  const cases = [
    ['message is dropped', { code: 'NOT_PAIRED', message: 'secret-looking text token=abc' }, 'NOT_PAIRED'],
    ['malformed detail code is dropped', { code: 'NOT_PAIRED', details: { code: 'token=abc' } }, 'NOT_PAIRED'],
    ['malformed code drops the rejection', { code: 'not paired; token=abc', details: { code: 'DEVICE_IDENTITY_REQUIRED' } }, null],
    ['missing error', undefined, null],
  ];
  for (const [name, error, rejection] of cases) {
    await t.test(name, async () => {
      const { WebSocketImpl } = ab5aTarget({
        authMode: 'none',
        connectResponse: (frame) => ({ type: 'res', id: frame.id, ok: false, error }),
      });
      const result = await inspectTarget(values.gatewayWs, values.signingKey, { WebSocketImpl, timeoutMs: 100 });
      assert.equal(result.error, 'gateway-auth-rejected');
      assert.equal(result.rejection, rejection);
      assert.doesNotMatch(JSON.stringify(targetNotes(result)), /token=abc|secret-looking/u);
    });
  }
});
